import dotenv from 'dotenv'

import { PORT, BASE_PATH, AUTH_USER, AUTH_PASS, DEBUG } from './constants'

dotenv.config()

export const path = process.env[BASE_PATH]
export const port = process.env[PORT]
export const user = process.env[AUTH_USER]
export const pass = process.env[AUTH_PASS]
export const debug = process.env[DEBUG] === 'true' || false

export const timezone = 'Europe/Bucharest'
