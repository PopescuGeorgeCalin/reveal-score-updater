import moment from 'moment-timezone'

import { getMDClients, getOrderDetails } from './vtex'
import localities from '../../data/localities.json'
import { timezone } from '../config/server'
import { dummyCategory, dummyBrand } from '../config/vtex'

export const getHashKey = (judet, city) =>
  `${judet.toUpperCase()} ${city.toUpperCase()}`

export const replaceDiacritics = key =>
  key
    .replace(/â/g, 'a')
    .replace(/Â/g, 'A')
    .replace(/ă/g, 'a')
    .replace(/Ă/g, 'A')
    .replace(/î/g, 'i')
    .replace(/Î/g, 'I')
    .replace(/ș/g, 's')
    .replace(/Ș/g, 'S')
    .replace(/ş/g, 's') // wrong cedilla
    .replace(/Ş/g, 'S') // wrong cedilla
    .replace(/ț/g, 't')
    .replace(/Ț/g, 'T')

export const getLocalityInfo = (judet, city) =>
  localities[replaceDiacritics(getHashKey(judet, city))]

export const customerName = customerData =>
  customerData.isCorporate
    ? customerData.corporateName
    : `${customerData.firstName} ${customerData.lastName}`

export const getAddress = orderDetails => {
  return `${orderDetails.shippingData.address.street || ''} ${orderDetails
    .shippingData.address.number || ''}, ${orderDetails.shippingData.address
    .complement || ''}, ${orderDetails.shippingData.address.city ||
    ''}, ${orderDetails.shippingData.address.postalCode || ''}`
}

export const clientRealEmail = async userId => {
  const { data: clients } = await getMDClients(userId)

  console.log(`UTIL CRE [${userId}]: <${clients[0].email || ''}>`)

  return clients[0].email
}

export const prepareOrderData = async orderId => {
  const { data: orderDetails } = await getOrderDetails(orderId)

  // const orderTotal = orderDetails.totals.reduce(
  //   (prev, cur) => prev + cur.value / 100,
  //   0
  // );

  // console.log(`Order ${order.orderId} total ${orderTotal} RON`);
  // console.log(orderDetails);

  const orderDate = moment(orderDetails.creationDate)
    .tz(timezone)
    .format('YYYYMMDDHHmmss')
  // console.log(`OD: [${orderDetails.creationDate}] -> ${orderDate}`);

  const shippingDate = moment(
    orderDetails.shippingData.logisticsInfo[0].shippingEstimateDate
  )
    .tz(timezone)
    .format('YYYYMMDDHHmmss')
  // console.log(
  //   `OSD: [${orderDetails.shippingData.logisticsInfo[0].shippingEstimateDate}] -> ${shippingDate}`
  // );

  const localityInfo = getLocalityInfo(
    orderDetails.shippingData.address.state,
    orderDetails.shippingData.address.city
  )

  const items = orderDetails.items.map(entry => ({
    idArticol: entry.refId.substr(1),
    codArticol: entry.refId,
    codExternArticol: entry.id,
    codBareArticol: entry.ean,
    cant: entry.quantity,
    pret: entry.sellingPrice * 0.01,
  }))

  // transport a832
  const shipping = orderDetails.totals.filter(item => item.id === 'Shipping')[0]
    .value

  shipping > 0 &&
    items.push({
      idArticol: '832',
      codArticol: 'a832',
      codExternArticol: '',
      codBareArticol: '',
      cant: 1,
      pret: shipping * 0.01,
    })

  // discount DSF
  //   const discount = order.totals.filter((item) => item.id === "Discounts")[0]
  //   .value;
  // discount > 0 &&
  //   items.push({
  //     name: "Discount",
  //     refId: "",
  //     ean: "DSF",
  //     quantity: 1,
  //     sellingPrice: discount,
  //     warehouse,
  //   });

  // tax TVA?
  // const tax = order.totals.filter((item) => item.id === "Tax")[0].value;
  // tax > 0 &&
  //   items.push({
  //     refId: "",
  //     ean: "TAX",
  //     quantity: 1,
  //     sellingPrice: tax,
  //     warehouse,
  //   });

  const clientEmail = await clientRealEmail(
    orderDetails.clientProfileData.userProfileId
  )

  const requestOrderJsonToErp = {
    idGestiune: 2,
    idTipCmd: 5,
    guid: orderDetails.orderId,
    data: orderDate,
    dataLivrare: shippingDate,
    numeClientFacturare: customerName(orderDetails.clientProfileData),
    cnpClientFacturare: '',
    actIdentitateClientFacturare: '',
    codFiscalClientFacturare:
      orderDetails.clientProfileData.corporateDocument || '',
    regComClientFacturare: orderDetails.clientProfileData.tradeName || '',
    taraClientFacturare: 'RO',
    judetClientFacturare: localityInfo && localityInfo.countyCode,
    localitateClientFacturare: localityInfo && localityInfo.code,
    adresaClientFacturare: getAddress(orderDetails),
    taraLivrare: 'RO',
    judetLivrare: localityInfo && localityInfo.countyCode,
    localitateLivrare: localityInfo && localityInfo.code,
    adresaLivrare: getAddress(orderDetails),
    codPostalLivrare: orderDetails.shippingData.address.postalCode,
    persoanaContactLivrare: orderDetails.shippingData.address.receiverName,
    telefonLivrare: orderDetails.clientProfileData.phone,
    emailLivrare: clientEmail || orderDetails.clientProfileData.email,
    modPlata:
      orderDetails.paymentData.transactions[0].payments[0].paymentSystemName,
    infoTransport: '',
    obs: '',
    pozCmd: items,
  }

  return requestOrderJsonToErp
}

export const prepareProductData = body => ({
  Name: body.numeArticol,
  DepartmentId: 1,
  CategoryId: dummyCategory,
  BrandId: dummyBrand,
  LinkId: `dummy-link-${body.idArticol}`,
  RefId: body.idArticol,
  IsVisible: true,
  Description: body.descriere,
  DescriptionShort: body.descriere,
  ReleaseDate: moment
    .tz(body.data, 'YYYYMMDDhhmmss', timezone)
    .utc()
    .format(),
  KeyWords: '',
  Title: body.numeArticol,
  IsActive: false,
  TaxCode: '',
  MetaTagDescription: '',
  SupplierId: 1,
  ShowWithoutStock: true,
  AdWordsRemarketingCode: '',
  LomadeeCampaignCode: '',
  Score: 1,
})

export const prepareSkuData = body => ({
  ProductId: body.ProductId,
  IsActive: false,
  Name: body.numeArticol,
  RefId: body.idArticol,
  PackagedHeight: body.inaltime,
  PackagedLength: body.lungime,
  PackagedWidth: body.latime,
  PackagedWeightKg: body.greutateBruta,
  Height: body.inaltime,
  Length: body.lungime,
  Width: body.latime,
  WeightKg: body.greutateNeta,
  CubicWeight: 1,
  IsKit: false,
  CreationDate: moment
    .tz(body.data, 'YYYYMMDDhhmmss', timezone)
    .utc()
    .format(),
  RewardValue: 1,
  EstimatedDateArrival: '',
  ManufacturerCode: '',
  CommercialConditionId: 1,
  MeasurementUnit: 'un',
  UnitMultiplier: 1,
  ModalType: '',
  KitItensSellApart: false,
})
