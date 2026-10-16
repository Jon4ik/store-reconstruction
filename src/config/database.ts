// Конфигурация подключения к PostgreSQL
// Эти данные можно изменить через настройки системы в web-интерфейсе
// или через переменные окружения

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl: boolean;
}

// Конфиг по умолчанию (может быть переопределён через .env)
export const defaultDbConfig: DatabaseConfig = {
  host: (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_DB_HOST) || 'localhost',
  port: parseInt((typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_DB_PORT) || '5432'),
  database: (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_DB_NAME) || 'store_reconstruction',
  username: (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_DB_USER) || 'postgres',
  password: (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_DB_PASSWORD) || '',
  ssl: (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_DB_SSL) === 'true',
};

// Пример .env файла:
// DB_HOST=localhost
// DB_PORT=5432
// DB_NAME=store_reconstruction
// DB_USER=postgres
// DB_PASSWORD=your_password
// DB_SSL=false

// Prisma schema (reference):
/*
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id        String   @id @default(uuid())
  username  String   @unique
  password  String
  fullName  String
  roleId    String
  role      Role     @relation(fields: [roleId], references: [id])
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Role {
  id          String   @id @default(uuid())
  name        String   @unique
  description String
  permissions String[]
  isSystem    Boolean  @default(false)
  users       User[]
  createdAt   DateTime @default(now())
}

model TU {
  id        String   @id @default(uuid())
  fullName  String
  position  String
  phone     String?
  email     String?
  isActive  Boolean  @default(true)
  projects  StoreProject[]
  createdAt DateTime @default(now())
}

model ShopDirectory {
  id              String   @id @default(uuid())
  shopNumber      String   @unique
  city            String   @default("")
  address         String
  workHours       String   @default("")
  areaManager     String   @default("")
  areaManagerPhone String  @default("")
  tu              String   @default("")
  directorate     String   @default("")
  projects        StoreProject[]
}

model StoreProject {
  id              String   @id @default(uuid())
  storeNumber     String
  shop            ShopDirectory @relation(fields: [storeNumber], references: [id])
  workType        String
  closureDate     DateTime?
  demolitionDate  DateTime?
  installationDate DateTime?
  techOpenDate    DateTime?
  tuId            String
  tu              TU       @relation(fields: [tuId], references: [id])
  rowColor        String   @default("")
  comment         String   @default("")
  status          String   @default("Запланирован")
  manualStatus    String?
  isDeleted       Boolean  @default(false)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  createdBy       String
  comments        Comment[]
  auditLogs       AuditLog[]
}

model Comment {
  id        String   @id @default(uuid())
  storeId   String
  store     StoreProject @relation(fields: [storeId], references: [id])
  userId    String
  userName  String
  text      String
  createdAt DateTime @default(now())
}

model AuditLog {
  id        String   @id @default(uuid())
  storeId   String?
  store     StoreProject? @relation(fields: [storeId], references: [id])
  userId    String?
  user      User?    @relation(fields: [userId], references: [id])
  userName  String
  timestamp DateTime @default(now())
  action    String
  field     String
  oldValue  String   @default("")
  newValue  String   @default("")
  details   String   @default("")
}
*/

// Connection string helper
export function getConnectionString(config: DatabaseConfig): string {
  const protocol = config.ssl ? 'postgresql+ssl' : 'postgresql';
  return `${protocol}://${config.username}:${config.password}@${config.host}:${config.port}/${config.database}`;
}
