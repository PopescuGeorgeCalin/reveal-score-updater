import dotenv from 'dotenv'

import {
  SPECTRUM_PASSWORD,
  SPECTRUM_USER,
  SPECTRUM_PORT,
  DRY_RUN,
} from './constants'

dotenv.config()

export const spectrumUser = process.env[SPECTRUM_USER]
export const spectrumPassword = process.env[SPECTRUM_PASSWORD]
export const spectrumPort = process.env[SPECTRUM_PORT]

export const dryrun = process.env[DRY_RUN] === 'true' || false
