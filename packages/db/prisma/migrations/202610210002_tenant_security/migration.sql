-- Run with the migration owner. Provision toolkit_app separately with a private password.
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO toolkit_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "User", "Session" TO toolkit_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO toolkit_app;
GRANT SELECT, UPDATE ON "Organization" TO toolkit_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON "Membership", "Project", "Task", "Comment", "Invitation" TO toolkit_app;
GRANT SELECT, INSERT ON "AuditLog" TO toolkit_app;

CREATE FUNCTION workspace_actor() RETURNS integer LANGUAGE sql STABLE AS $$
 SELECT nullif(current_setting('app.actor', true), '')::integer
$$;
CREATE FUNCTION workspace_tenant() RETURNS text LANGUAGE sql STABLE AS $$
 SELECT nullif(current_setting('app.tenant', true), '')
$$;
CREATE FUNCTION workspace_role(tenant text) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
 SELECT "role" FROM public."Membership" WHERE "organizationId" = tenant AND "userId" = public.workspace_actor()
$$;

ALTER TABLE "Membership" ADD CONSTRAINT membership_role CHECK (role IN ('OWNER','ADMIN','MEMBER','VIEWER'));
CREATE UNIQUE INDEX membership_one_owner ON "Membership" ("organizationId") WHERE role = 'OWNER';
ALTER TABLE "Invitation" ADD CONSTRAINT invitation_role CHECK (role IN ('ADMIN','MEMBER','VIEWER'));
ALTER TABLE "Project" ADD CONSTRAINT project_status CHECK (status IN ('PLANNED','ACTIVE','DONE'));
ALTER TABLE "Task" ADD CONSTRAINT task_status CHECK (status IN ('TODO','ACTIVE','DONE'));

ALTER TABLE "Organization" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Organization" FORCE ROW LEVEL SECURITY;
CREATE POLICY organization_read ON "Organization" FOR SELECT USING (workspace_role(id) IS NOT NULL);
CREATE POLICY organization_update ON "Organization" FOR UPDATE USING (id = workspace_tenant() AND workspace_role(id) IN ('OWNER','ADMIN'));

ALTER TABLE "Membership" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Membership" FORCE ROW LEVEL SECURITY;
CREATE POLICY membership_read ON "Membership" FOR SELECT USING (
 "userId" = workspace_actor() OR ("organizationId" = workspace_tenant() AND workspace_role("organizationId") IS NOT NULL)
);
CREATE POLICY membership_insert ON "Membership" FOR INSERT WITH CHECK (
 "organizationId" = workspace_tenant() AND workspace_role("organizationId") IN ('OWNER','ADMIN')
);
CREATE POLICY membership_update ON "Membership" FOR UPDATE USING (
 "organizationId" = workspace_tenant() AND workspace_role("organizationId") IN ('OWNER','ADMIN')
);
CREATE POLICY membership_delete ON "Membership" FOR DELETE USING (
 "organizationId" = workspace_tenant() AND workspace_role("organizationId") IN ('OWNER','ADMIN')
);

DO $$ DECLARE tab text; BEGIN
 FOREACH tab IN ARRAY ARRAY['Project','Task','Comment','Invitation','AuditLog'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tab);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tab);
  EXECUTE format('CREATE POLICY tenant_read ON %I FOR SELECT USING ("organizationId" = workspace_tenant() AND workspace_role("organizationId") IS NOT NULL)', tab);
  IF tab = 'AuditLog' THEN
   EXECUTE format('CREATE POLICY tenant_insert ON %I FOR INSERT WITH CHECK ("organizationId" = workspace_tenant() AND "actorId" = workspace_actor() AND workspace_role("organizationId") IS NOT NULL)', tab);
  ELSE
   EXECUTE format('CREATE POLICY tenant_write ON %I FOR ALL USING ("organizationId" = workspace_tenant() AND workspace_role("organizationId") IN (''OWNER'',''ADMIN''%s)) WITH CHECK ("organizationId" = workspace_tenant() AND workspace_role("organizationId") IN (''OWNER'',''ADMIN''%s))', tab, CASE WHEN tab='Invitation' THEN '' ELSE ',''MEMBER''' END, CASE WHEN tab='Invitation' THEN '' ELSE ',''MEMBER''' END);
  END IF;
 END LOOP;
END $$;

CREATE FUNCTION workspace_create(tenant text, title text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
BEGIN
 IF public.workspace_actor() IS NULL OR length(title) NOT BETWEEN 1 AND 100 OR length(tenant) > 64 THEN
  RAISE EXCEPTION 'Invalid workspace creation';
 END IF;
 INSERT INTO public."Organization" (id,name,"createdAt") VALUES (tenant,title,now());
 INSERT INTO public."Membership" ("organizationId","userId",role,"createdAt") VALUES (tenant,public.workspace_actor(),'OWNER',now());
END $$;

CREATE FUNCTION workspace_accept(digest text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE invitation public."Invitation"; tenant text; email_address text;
BEGIN
 SELECT "email" INTO email_address FROM public."User" WHERE id = public.workspace_actor();
 SELECT "organizationId" INTO tenant FROM public."Invitation" WHERE "tokenHash" = digest AND email=email_address;
 IF tenant IS NULL THEN RETURN NULL; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(tenant, 21021));
 PERFORM id FROM public."Organization" WHERE id=tenant FOR UPDATE;
 SELECT * INTO invitation FROM public."Invitation" WHERE "tokenHash"=digest FOR UPDATE;
 IF invitation.email <> email_address OR invitation."expiresAt" <= now() OR invitation."acceptedAt" IS NOT NULL OR invitation."revokedAt" IS NOT NULL THEN RETURN NULL; END IF;
 IF EXISTS (SELECT 1 FROM public."Membership" WHERE "organizationId"=tenant AND "userId"=public.workspace_actor()) THEN RETURN NULL; END IF;
 INSERT INTO public."Membership" ("organizationId","userId",role,"createdAt") VALUES (tenant,public.workspace_actor(),invitation.role,now());
 UPDATE public."Invitation" SET "acceptedAt"=now() WHERE id=invitation.id;
 RETURN tenant;
END $$;

CREATE FUNCTION workspace_owner_integrity() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE tenant text;
BEGIN
 tenant := CASE WHEN TG_OP='DELETE' THEN OLD."organizationId" ELSE NEW."organizationId" END;
 IF EXISTS (SELECT 1 FROM public."Organization" WHERE id=tenant) AND
    (SELECT count(*) FROM public."Membership" WHERE "organizationId"=tenant AND role='OWNER') <> 1 THEN
  RAISE EXCEPTION 'Organization must retain exactly one owner';
 END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER membership_owner_integrity AFTER INSERT OR UPDATE OR DELETE ON "Membership"
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION workspace_owner_integrity();

CREATE FUNCTION workspace_audit_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Audit records are append-only'; END $$;
CREATE TRIGGER audit_immutable BEFORE UPDATE OR DELETE ON "AuditLog" FOR EACH ROW EXECUTE FUNCTION workspace_audit_immutable();

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
GRANT EXECUTE ON FUNCTION workspace_actor(), workspace_tenant(), workspace_role(text), workspace_create(text,text), workspace_accept(text) TO toolkit_app;
