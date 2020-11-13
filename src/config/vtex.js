import dotenv from 'dotenv'

import {
  VTEX_ACCOUNT,
  VTEX_APP_KEY,
  VTEX_APP_TOKEN,
  DUMMY_CATEGORY_ID,
  DUMMY_BRAND_ID,
} from './constants'

dotenv.config()

export const accountName = process.env[VTEX_ACCOUNT]
export const appKey = process.env[VTEX_APP_KEY]
export const appToken = process.env[VTEX_APP_TOKEN]

export const dummyCategory = 1 * process.env[DUMMY_CATEGORY_ID] || 1
export const dummyBrand = 1 * process.env[DUMMY_BRAND_ID] || 200000
