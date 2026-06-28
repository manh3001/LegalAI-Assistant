-- LegAI Postgres schema (translated from SQL Server LegalBotDB).
-- Columns are lowercase; the app shim re-cases result keys.
-- bit -> smallint (code uses = 1 / = 0). nvarchar -> varchar/text.
-- datetime/datetime2 -> timestamptz.

CREATE TABLE IF NOT EXISTS aifeatureusage (
  id          int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  userid      bigint,
  featurename varchar(100) NOT NULL,
  usagecount  int NOT NULL,
  lastused    timestamptz NOT NULL,
  createdat   timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS aihistory (
  id            int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  userid        bigint,
  querytext     text NOT NULL,
  responsetext  text,
  operationtype varchar(100),
  createdat     timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS appconfigurations (
  id            int PRIMARY KEY,
  appname       varchar(255) NOT NULL,
  adminemail    varchar(255) NOT NULL,
  geminiapikey  varchar(500) NOT NULL,
  geminimodel   varchar(100) NOT NULL,
  temperature   numeric(3,2) NOT NULL,
  pineconeapikey varchar(500) NOT NULL,
  pineconeindex varchar(255) NOT NULL,
  createdat     timestamptz,
  updatedat     timestamptz
);

CREATE TABLE IF NOT EXISTS contracthistory (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  userid           bigint NOT NULL,
  filename         text,
  originalfilename varchar(260),
  filepath         text,
  uploadedat       timestamptz NOT NULL,
  analysisat       timestamptz,
  riskscore        int,
  confidence       double precision,
  analysisjson     text,
  analysistext     text,
  aimodel          varchar(200),
  durationms       int,
  isfinal          smallint NOT NULL,
  createdat        timestamptz NOT NULL,
  updatedat        timestamptz,
  recordtype       varchar(50),
  title            varchar(500),
  folder           varchar(200),
  status           varchar(50),
  deletedat        timestamptz,
  contracttext     text,
  description      text
);

CREATE TABLE IF NOT EXISTS feedbacks (
  id           int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  userid       int,
  name         varchar(200) NOT NULL,
  email        varchar(320) NOT NULL,
  type         varchar(50) NOT NULL,
  rating       int NOT NULL,
  content      text NOT NULL,
  status       varchar(50),
  replycontent text,
  createdat    timestamptz
);

CREATE TABLE IF NOT EXISTS lawyers (
  id        int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  fullname  varchar(100) NOT NULL,
  phone     varchar(20) NOT NULL,
  specialty varchar(200),
  isactive  smallint,
  createdat timestamptz
);

CREATE TABLE IF NOT EXISTS legaldocuments (
  id                 varchar(500) PRIMARY KEY,
  title              varchar(500) NOT NULL,
  documentnumber     varchar(100),
  issueyear          int,
  status             varchar(50),
  category           varchar(100),
  content            text,
  createdat          timestamptz,
  sourceurl          varchar(500),
  syncstatusssms     varchar(50),
  syncstatuspinecone varchar(50),
  agency             varchar(500),
  issuedatestring    varchar(500)
);

CREATE TABLE IF NOT EXISTS systemsettings (
  id             int PRIMARY KEY,
  isautocrawlon  smallint NOT NULL,
  crawltime      varchar(5) NOT NULL,
  targeturls     text,
  dailylimit     int NOT NULL,
  filterpatterns text,
  updatedat      timestamptz
);

CREATE TABLE IF NOT EXISTS userrecentlyviewed (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  userid         bigint NOT NULL,
  documentid     varchar(500) NOT NULL,
  documenttitle  text NOT NULL,
  documentnumber varchar(50) NOT NULL,
  issueyear      int,
  viewedat       timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email           varchar(320) NOT NULL,
  password        text,
  fullname        varchar(200),
  role            varchar(20) NOT NULL,
  createdat       timestamptz NOT NULL,
  updatedat       timestamptz,
  resetpin        varchar(10),
  resetpinexpires timestamptz,
  status          varchar(20) NOT NULL,
  googleid        varchar(100),
  avatar          varchar(1000),
  authprovider    varchar(50)
);

CREATE TABLE IF NOT EXISTS usersavedlaws (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  userid         bigint NOT NULL,
  documentid     varchar(500) NOT NULL,
  documenttitle  varchar(500) NOT NULL,
  documentnumber varchar(100),
  issueyear      int,
  savedat        timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS videohistory (
  id             int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  userid         bigint NOT NULL,
  videourl       varchar(500) NOT NULL,
  platform       varchar(50),
  title          varchar(500),
  transcript     text,
  summary        text,
  legalbases     text,
  trustscore     int,
  aimodel        varchar(100),
  createdat      timestamptz,
  status         varchar(50),
  lastaccessedat timestamptz,
  accesscount    int,
  analysisjson   text
);

-- Column DEFAULTs (translated from the SQL Server DEFAULT constraints).
-- getdate() -> now(); sysutcdatetime() -> (now() at time zone 'utc').
-- Idempotent: ALTER ... SET DEFAULT can be re-run safely.
ALTER TABLE aifeatureusage    ALTER COLUMN usagecount         SET DEFAULT 0;
ALTER TABLE aifeatureusage    ALTER COLUMN lastused           SET DEFAULT (now() at time zone 'utc');
ALTER TABLE aifeatureusage    ALTER COLUMN createdat          SET DEFAULT (now() at time zone 'utc');
ALTER TABLE aihistory         ALTER COLUMN createdat          SET DEFAULT (now() at time zone 'utc');
ALTER TABLE appconfigurations ALTER COLUMN createdat          SET DEFAULT now();
ALTER TABLE appconfigurations ALTER COLUMN updatedat          SET DEFAULT now();
ALTER TABLE contracthistory   ALTER COLUMN uploadedat         SET DEFAULT (now() at time zone 'utc');
ALTER TABLE contracthistory   ALTER COLUMN isfinal            SET DEFAULT 1;
ALTER TABLE contracthistory   ALTER COLUMN createdat          SET DEFAULT (now() at time zone 'utc');
ALTER TABLE contracthistory   ALTER COLUMN recordtype         SET DEFAULT 'ANALYSIS';
ALTER TABLE contracthistory   ALTER COLUMN folder             SET DEFAULT 'Chưa phân loại';
ALTER TABLE contracthistory   ALTER COLUMN status             SET DEFAULT 'Thành công';
ALTER TABLE feedbacks         ALTER COLUMN status             SET DEFAULT 'Pending';
ALTER TABLE feedbacks         ALTER COLUMN createdat          SET DEFAULT now();
ALTER TABLE lawyers           ALTER COLUMN isactive           SET DEFAULT 1;
ALTER TABLE lawyers           ALTER COLUMN createdat          SET DEFAULT now();
ALTER TABLE legaldocuments    ALTER COLUMN category           SET DEFAULT 'Chưa phân loại';
ALTER TABLE legaldocuments    ALTER COLUMN createdat          SET DEFAULT now();
ALTER TABLE legaldocuments    ALTER COLUMN syncstatusssms     SET DEFAULT 'syncing';
ALTER TABLE legaldocuments    ALTER COLUMN syncstatuspinecone SET DEFAULT 'syncing';
ALTER TABLE systemsettings    ALTER COLUMN isautocrawlon      SET DEFAULT 0;
ALTER TABLE systemsettings    ALTER COLUMN crawltime          SET DEFAULT '02:00';
ALTER TABLE systemsettings    ALTER COLUMN dailylimit         SET DEFAULT 20;
ALTER TABLE systemsettings    ALTER COLUMN updatedat          SET DEFAULT now();
ALTER TABLE userrecentlyviewed ALTER COLUMN viewedat          SET DEFAULT (now() at time zone 'utc');
ALTER TABLE users             ALTER COLUMN createdat          SET DEFAULT (now() at time zone 'utc');
ALTER TABLE users             ALTER COLUMN status             SET DEFAULT 'Active';
ALTER TABLE usersavedlaws     ALTER COLUMN savedat            SET DEFAULT (now() at time zone 'utc');
ALTER TABLE videohistory      ALTER COLUMN trustscore         SET DEFAULT 0;
ALTER TABLE videohistory      ALTER COLUMN aimodel            SET DEFAULT 'gemini-1.5-flash';
ALTER TABLE videohistory      ALTER COLUMN createdat          SET DEFAULT now();
ALTER TABLE videohistory      ALTER COLUMN status             SET DEFAULT 'Thành công';
ALTER TABLE videohistory      ALTER COLUMN accesscount        SET DEFAULT 1;
