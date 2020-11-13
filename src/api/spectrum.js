import https from 'https'

import axios from 'axios'

import {
  spectrumPassword,
  spectrumUser,
  spectrumPort,
  dryrun,
} from '../config/spectrum'

console.log('DRY_RUN: ', dryrun)

// DEV: `https://${spectrumUser}:${spectrumPassword}@www.spectrumretail.ro:9081/sirius-site-backend.1.0.0/rest/comenzi/insert-cmdsite`,

// fix SSL self signed cert
const instance = axios.create({
  httpsAgent: new https.Agent({
    rejectUnauthorized: false,
  }),
})

export const updateOrderToSpectrum = data =>
  dryrun
    ? console.log('DUMMY POST to Spectrum...')
    : instance.post(
        `https://${spectrumUser}:${spectrumPassword}@www.spectrumretail.ro:${spectrumPort}/sirius-site-backend.1.0.0/rest/comenzi/insert-cmdsite`,
        data
      )
