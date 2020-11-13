import axios from 'axios'
import moment from 'moment-timezone'

import { accountName, appKey, appToken } from '../config/vtex'

const vtexInstance = axios.create({
  baseURL: `https://${accountName}.myvtex.com/api/`,
  timeout: 10000,
  headers: {
    'Control-Cache': 'proxy-revalidate, no-cache, no-store',
    'Content-Type': 'application/json',
    'X-VTEX-API-AppKey': appKey,
    'X-VTEX-API-AppToken': appToken,
  },
})

// TODO: check for multiple warehouses
export const identifyProductWarehouse = async skuId =>
  vtexInstance.get(`/logistics/pvt/inventory/skus/${skuId}`)

// a in front of refId is on purpose because refcodes are imported as A123
export const identifySkuByRefId = async refId =>
  vtexInstance.get(
    `/catalog_system/pvt/sku/stockkeepingunitidbyrefid/a${refId}`
  )

export const identifyProductByRefId = async refId =>
  vtexInstance.get(`/catalog_system/pvt/products/productgetbyrefid/${refId}`)

// TODO: SKUID instead of ProductID
export const updatePriceByProductId = async (skuId, price) =>
  axios.put(
    `https://api.vtex.com/${accountName}/pricing/prices/${skuId}`,
    {
      listPrice: price,
      basePrice: price,
      costPrice: price,
    },
    {
      headers: {
        'Content-type': 'application/json',
        'x-vtex-api-appkey': appKey,
        'x-vtex-api-apptoken': appToken,
      },
    }
  )

export const MAX_PER_PAGE_SIZE = 30

export const getAllOrders = async lastMinutes => {
  const startDate = moment()
    .subtract(lastMinutes || 1440, 'minute') // default last 24hr RfH
    .utc()
    .format()

  const endDate = moment()
    .utc()
    .format()

  console.log(`getRfHOrders from ${startDate} to ${endDate}`)

  let hasNextPage = true
  let page = 1
  let allOrders = []

  while (hasNextPage) {
    // TODO: needs delay, max 5000 requests / minute + max per-page = 30
    const orderList = (
      await vtexInstance.get(
        `/oms/pvt/orders?f_status=ready-for-handling&f_creationDate=creationDate:[${startDate} TO ${endDate}]&page=${page}&per_page=${MAX_PER_PAGE_SIZE}`
      )
    ).data.list

    allOrders = allOrders.concat(orderList)

    if (orderList.length !== MAX_PER_PAGE_SIZE) {
      hasNextPage = false
    } else {
      page += 1
    }
  }

  return allOrders
}

export const getOrderDetails = async orderId =>
  vtexInstance.get(`/oms/pvt/orders/${orderId}`)

export const updateSkuStock = async (skuId, warehouseId, quantity) =>
  vtexInstance.put(
    `/logistics/pvt/inventory/skus/${skuId}/warehouses/${warehouseId}`,
    {
      unlimitedQuantity: false,
      dateUtcOnBalanceSystem: null,
      quantity,
    }
  )

export const getMDClients = async userId =>
  vtexInstance.get(`/dataentities/CL/search?_fields=_all&userId=${userId}`)

export const orderInvoiceNotification = async (orderId, data) =>
  vtexInstance.post(`/oms/pvt/orders/${orderId}/invoice`, data)

export const orderStartHandling = async orderId =>
  vtexInstance.post(`/oms/pvt/orders/${orderId}/start-handling`)

export const createProduct = async data =>
  vtexInstance.post(`/catalog/pvt/product`, data)

export const createSku = async data =>
  vtexInstance.post(`/catalog/pvt/stockkeepingunit`, data)
