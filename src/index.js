import express from 'express'
import moment from 'moment-timezone'
import basicAuth from 'express-basic-auth'

import {
  getAllOrders,
  getOrderDetails,
  identifyProductWarehouse,
  identifyProductByRefId,
  identifySkuByRefId,
  updatePriceByProductId,
  updateSkuStock,
  orderInvoiceNotification,
  orderStartHandling,
  createProduct,
  createSku,
} from './api/vtex'
import {
  prepareOrderData,
  prepareProductData,
  prepareSkuData,
} from './api/utils'
import { updateOrderToSpectrum } from './api/spectrum'
import { port, path, user, pass, debug, timezone } from './config/server'

// Set up the express app
const app = express()

app.use(express.json()) // to support JSON-encoded bodies
app.use(express.urlencoded({ extended: true }))

app.get(`${path}/health`, (req, res) => {
  res.send('OK')
})

// TODO: validari
app.post(
  `${path}/update-price`,
  basicAuth({ users: { [user]: pass } }),
  async (req, res) => {
    try {
      const { data: skuId } = await identifySkuByRefId(req.body.idArticol)

      if (!skuId) {
        throw new Error(`No SKU found for ${req.body.idArticol}`)
      }

      // ignored: req.body.pretIesCuTvaRevenire,

      if (req.body.pretIesCuTva <= 0) {
        throw new Error(`Negative or 0 price: ${req.body.pretIesCuTva}`)
      }

      await updatePriceByProductId(skuId, req.body.pretIesCuTva)

      debug &&
        console.log(
          `UP OK: SKU ${skuId} (a${req.body.idArticol})=> ${req.body.pretIesCuTva}`
        )

      res.send({
        status: 'success',
        message: 'Produsul a fost actualizat',
      })
    } catch (error) {
      console.error(
        `UP ERROR: ${error.message} | ${JSON.stringify(req.body) ||
          'noReqBody'}`
      )
      res.send({
        status: 'error',
        message: 'Produsul NU a fost actualizat',
      })
    }
  }
)

// TO DO: category, brand
app.post(
  `${path}/add-product`,
  basicAuth({ users: { [user]: pass } }),
  async (req, res) => {
    try {
      // TODO: update instead of throwing errors
      const { data: productExists } = await identifyProductByRefId(
        req.body.idArticol
      )

      if (productExists) {
        throw {
          message: `CONFLICT. Produs deja existent cu refId=${req.body.idArticol}`,
        }
      }

      const { data: skuExists } = await identifySkuByRefId(req.body.idArticol)

      if (skuExists) {
        throw {
          message: `CONFLICT. Produs deja existent cu refId=${req.body.idArticol}`,
        }
      }

      const productData = prepareProductData(req.body)
      const {
        data: { Id: ProductId },
      } = await createProduct(productData)

      const skuData = prepareSkuData({ ...req.body, ProductId })

      await createSku(skuData)

      res.send({
        status: 'success',
        message: 'Produsul a fost adaugat',
      })
    } catch (err) {
      console.error(
        `UP ERROR: ${err.message} | ${JSON.stringify(req.body) || 'noReqBody'}`
      )
      res.send({
        status: 'error',
        message: 'Produsul NU a fost adaugat',
      })
    }
  }
)

// TODO: validations  + define default warehouse to update stock as param
app.post(
  `${path}/update-stock`,
  basicAuth({ users: { [user]: pass } }),
  async (req, res) => {
    try {
      const { data: skuId } = await identifySkuByRefId(req.body.idArticol)

      if (!skuId) {
        throw new Error(`No SKU found for ${req.body.idArticol}`)
      }

      const { data: warehouse } = await identifyProductWarehouse(skuId)
      const { warehouseId } = warehouse.balance[0]

      if (!warehouseId) {
        throw new Error(
          `No warehouse found for ${skuId} (${req.body.idArticol})`
        )
      }

      await updateSkuStock(skuId, warehouseId, req.body.stoc)

      debug &&
        console.log(
          `US OK: SKU ${skuId} (a${req.body.idArticol}) WH ${warehouseId} => ${req.body.stoc}`
        )

      res.send({
        status: 'success',
        message: 'Produsul a fost actualizat',
      })
    } catch (error) {
      console.error(
        `US ERROR: ${error.message} | ${JSON.stringify(req.body) ||
          'noReqBody'}`
      )
      res.send({
        status: 'error',
        message: 'Produsul NU a fost actualizat',
      })
    }
  }
)

// TODO: validari
app.post(
  `${path}/order-invoice-notification`,
  basicAuth({ users: { [user]: pass } }),
  async (req, res) => {
    try {
      // {
      //     "idGestiune": 2,
      //     "guidComanda": "1060843032804-01",
      //     "idIesire": 2476939,
      //     "dataDoc": "20200910000000",
      //     "serieDoc": "MRVOL",
      //     "numarDoc": 26888,
      //     "url": "https://www.spectrumretail.ro:17214/sirius-reporting/render_report?pNumeRaport=crystal%2Fdocumente%2Fiesiri%2FfacturaFiscalaCuChitantaMavrilog.rpt&pIdSocietate=1&pNumeSocietate=MARVI LOGISTIC SRL&caleResurse=/opt/oracle/sirius/resurse&jndiName=java%3Acomp%2Fenv%2Fjdbc%2FsiriusDS&databaseUserName=SIRIUS_MARVILOG&formatat=false&reportType=pdf&inline=true&pIdSesiune=0&pUtilizator=site&pIdIesire=2476939&pHeader=c%3A%2F%2F",
      //     "data": "20200910172419"
      // }

      const orderId = req.body.guidComanda

      if (!orderId) {
        throw new Error('No order ID')
      }

      const { data: orderDetails } = await getOrderDetails(orderId)

      const orderTotalNoDecimals = orderDetails.totals.reduce(
        (prev, cur) => prev + cur.value,
        0
      )

      const items = orderDetails.items.map(entry => ({
        id: entry.id,
        price: entry.sellingPrice,
        quantity: entry.quantity,
      }))

      const data = {
        invoiceNumber: req.body.numarDoc,
        invoiceValue: orderTotalNoDecimals,
        issuanceDate: moment
          .tz(req.body.dataDoc, 'YYYYMMDDhhmmss', timezone)
          .utc()
          .format(),
        invoiceUrl: req.body.url,
        invoiceKey: req.body.serieDoc,
        trackingNumber: '',
        trackingUrl: '',
        courier: '',
        items,
      }

      const { data: response } = await orderInvoiceNotification(orderId, data)

      if (response && response.receipt) {
        debug &&
          console.log(`OIN OK: Order ${orderId} receipt ${response.receipt}`)

        res.send({
          status: 'success',
          message: 'Comanda a fost actualizata',
        })
      } else {
        res.send({
          status: 'error',
          message: 'Comanda nu a fost actualizata',
        })
      }
    } catch (error) {
      console.error(
        `OIN ERROR: ${error.message} | ${JSON.stringify(req.body) ||
          'noReqBody'}`
      )
      res.send({
        status: 'error',
        message: 'Comanda a fost actualizata',
      })
    }
  }
)

app.get(
  `${path}/sync-orders/:lastMinutes?`,
  basicAuth({ users: { [user]: pass } }),
  async (req, res) => {
    try {
      const interval = req.params.lastMinutes || 1440 // 24hr

      const orders = await getAllOrders(interval)

      console.log(
        `SO processing ${orders.length} orders in ready-for-handling status in the last ${interval} minutes.`
      )

      orders
        // .filter((o) => o.orderId === "1054811498203-01")
        .forEach(async order => {
          const orderId = order.orderId

          try {
            const requestOrderJsonToErp = await prepareOrderData(orderId)

            debug && console.log(JSON.stringify(requestOrderJsonToErp))

            await updateOrderToSpectrum(requestOrderJsonToErp)
            console.log(`SO order ${orderId} sent to ERP`)
            // start handling order in VTEX
            await orderStartHandling(orderId)
            console.log(`SO order ${orderId} status: Start Handling`)
          } catch (error) {
            console.error(`SO ${orderId} ERROR: ${error.message}`)
          }
        })
      res.send('OK')
    } catch (error) {
      console.error(`SO1 ERROR: ${error.message}`)
      res.send({
        status: 'error',
        message: 'Eroare la procesarea comenzii',
      })
    }
  }
)

app.get(
  `${path}/sync-order/:orderId`,
  basicAuth({ users: { [user]: pass } }),
  async (req, res) => {
    try {
      const { orderId } = req.params

      console.log(`SO1 ${orderId} processing...`)

      try {
        const requestOrderJsonToErp = await prepareOrderData(orderId)

        debug && console.log(JSON.stringify(requestOrderJsonToErp))

        await updateOrderToSpectrum(requestOrderJsonToErp)
        console.log(`SO1 order ${orderId} sent to ERP`)

        // start handling order in VTEX
        await orderStartHandling(orderId)
        console.log(`SO1 order ${orderId} status: Start Handling`)
      } catch (error) {
        console.error(`SO1 ${orderId} ERROR: ${error.message}`)
      }

      res.send('OK')
    } catch (error) {
      console.error(`SO1 ERROR: ${error.message}`)
      res.send({
        status: 'error',
        message: 'Eroare la procesarea comenzii',
      })
    }
  }
)

app.listen(port, () => {
  console.log(`Server running on port ${port} and path ${path}`)
})
