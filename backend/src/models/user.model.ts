import { pool, type Queryable } from "../config/database.js";
import type { User } from "../types/auth.js";

interface UserRow {
  id: string;
  username: string;
  email: string;
  password_hash: string;
  email_verified: boolean;
  created_at: Date;
  updated_at: Date;
}

function mapUser(row: UserRow): User {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    passwordHash: row.password_hash,
    emailVerified: row.email_verified,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const USER_COLUMNS =
  "id, username, email, password_hash, email_verified, created_at, updated_at";

export async function findUserByEmail(email: string): Promise<User | null> {
  const result = await pool.query<UserRow>(
    `SELECT ${USER_COLUMNS}
     FROM users
     WHERE email = $1`,
    [email.toLowerCase()],
  );

  return result.rows[0] ? mapUser(result.rows[0]) : null;
}

export async function findUserByUsername(username: string): Promise<User | null> {
  const result = await pool.query<UserRow>(
    `SELECT ${USER_COLUMNS}
     FROM users
     WHERE username = $1`,
    [username.toLowerCase()],
  );

  return result.rows[0] ? mapUser(result.rows[0]) : null;
}

export async function findUserById(id: string): Promise<User | null> {
  const result = await pool.query<UserRow>(
    `SELECT ${USER_COLUMNS}
     FROM users
     WHERE id = $1`,
    [id],
  );

  return result.rows[0] ? mapUser(result.rows[0]) : null;
}

export async function createUser(input: {
  username: string;
  email: string;
  passwordHash: string;
}, db: Queryable = pool): Promise<User> {
  const result = await db.query<UserRow>(
    `INSERT INTO users (username, email, password_hash, email_verified)
     VALUES ($1, $2, $3, TRUE)
     RETURNING ${USER_COLUMNS}`,
    [input.username.toLowerCase(), input.email.toLowerCase(), input.passwordHash],
  );

  return mapUser(result.rows[0]);
}
