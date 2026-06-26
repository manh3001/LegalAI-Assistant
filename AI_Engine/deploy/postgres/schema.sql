-- LegAI Postgres schema (translated from SQL Server LegalBotDB).
-- Columns are lowercase; the app shim re-cases result keys.
-- bit -> smallint (code uses = 1 / = 0). nvarchar -> varchar/text.
-- datetime/datetime2 -> timestamptz.

CREATE TABLE aifeatureusage (
  id          int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  userid      bigint,
  featurename varchar(100) NOT NULL,
  usagecount  int NOT NULL,
  lastused    timestamptz NOT NULL,
  createdat   timestamptz NOT NULL
);

CREATE TABLE aihistory (
  id            int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  userid        bigint,
  querytext     text NOT NULL,
  responsetext  text,
  operationtype varchar(100),
  createdat     timestamptz NOT NULL
);

CREATE TABLE appconfigurations (
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

CREATE TABLE contracthistory (
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

CREATE TABLE feedbacks (
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

CREATE TABLE lawyers (
  id        int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  fullname  varchar(100) NOT NULL,
  phone     varchar(20) NOT NULL,
  specialty varchar(200),
  isactive  smallint,
  createdat timestamptz
);

CREATE TABLE legaldocuments (
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

CREATE TABLE systemsettings (
  id             int PRIMARY KEY,
  isautocrawlon  smallint NOT NULL,
  crawltime      varchar(5) NOT NULL,
  targeturls     text,
  dailylimit     int NOT NULL,
  filterpatterns text,
  updatedat      timestamptz
);

CREATE TABLE userrecentlyviewed (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  userid         bigint NOT NULL,
  documentid     varchar(500) NOT NULL,
  documenttitle  text NOT NULL,
  documentnumber varchar(50) NOT NULL,
  issueyear      int,
  viewedat       timestamptz NOT NULL
);

CREATE TABLE users (
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

CREATE TABLE usersavedlaws (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  userid         bigint NOT NULL,
  documentid     varchar(500) NOT NULL,
  documenttitle  varchar(500) NOT NULL,
  documentnumber varchar(100),
  issueyear      int,
  savedat        timestamptz NOT NULL
);

CREATE TABLE videohistory (
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
