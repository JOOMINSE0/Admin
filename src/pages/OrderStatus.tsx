import { useState, useEffect, useRef, useMemo } from 'react'
import * as XLSX from 'xlsx'
import CollapsibleSection from '../components/CollapsibleSection'
import OrderDetailModal, {
  getSupplierOrderStatusFromSap,
  normalizeSupplierForSap,
  type OrderDetailData,
} from '../components/OrderDetailModal'
import styles from './OrderPage.module.css'

const breadcrumb = ['홈', '주문관리', '주문현황']
const supplierOptions = [
  '선택',
  'GC녹십자웰빙',
  'ohj테스트',
  '대웅바이오',
  '대웅제약',
  '동구바이오제약',
  '동암메디팜 도매(동구바이오)',
  '디엔컴퍼니2테스트',
  '신텍스헬스케어',
  '에치엔지(콜마)',
  '한국메디젠',
  '한국비엔에스',
  '한올바이오파마',
  '한화제약',
  '(주)기영약품',
  '광동제약',
  '광주 태전약품',
  '광주지오팜',
  '광주지오팜(도매)',
  '뉴스타팜',
  '다올약품',
  '다원메디컬',
  '다원메디컬 B',
  '대전 지오영',
  '대전지오팜',
  '대전지오팜(도매)',
  '더샵플러스(기영약품)',
  '더샵플러스(백제약품)',
  '더샵플러스(복산나이스)',
  '도체오',
  '동암메디팜',
  '동인제약',
  '동인제약(부산)',
  '로하스메디',
  '로하스메디(도매)',
  '메디상사',
  '미드팜',
  '백광의약품',
  '백제약품 광주',
  '백제약품 대전',
  '백제약품 동부',
  '백제약품 부산',
  '백제약품 분당',
  '백제약품 신도림',
  '백제약품 영남',
  '백제약품 영등포(평택)',
  '백제약품 원주',
  '백제약품 전주',
  '백제약품 제주',
  '보덕메디팜',
  '복산나이스 경남',
  '복산나이스 동부',
  '복산나이스 부산',
  '복산나이스 서울',
  '복산나이스 평택',
  '서울약사신협',
  '서울약업',
  '서울지오팜',
  '서울지오팜(도매)',
  '서진팜',
]

const searchTypeOptions = ['약국명', '주문번호', '회원 아이디', '유저키', '사업자번호', '고객명', '상품명']

/** 발송준비중 배송지역 필터 (시도 → 구군 → 읍면동) */
const PLACEHOLDER_SIDO = '-시도-'
const PLACEHOLDER_GUGUN = '-구군-'
const PLACEHOLDER_EUP = '-읍면동-'

/** 발송 준비중 탭 시도 드롭다운 순서 (화면 스펙) */
const PREPARING_SIDO_ORDER = [
  '강원',
  '경기',
  '경남',
  '경북',
  '광주',
  '대구',
  '대전',
  '부산',
  '서울',
  '세종',
  '울산',
  '인천',
  '전남',
  '전북',
  '제주',
  '충남',
  '충북',
] as const

const GUGUN_PLACEHOLDER_ONLY: Record<string, string[]> = {
  [PLACEHOLDER_GUGUN]: [PLACEHOLDER_EUP],
}

const REGION_TREE: Record<string, Record<string, string[]>> = {
  [PLACEHOLDER_SIDO]: GUGUN_PLACEHOLDER_ONLY,
  강원: { ...GUGUN_PLACEHOLDER_ONLY },
  경남: { ...GUGUN_PLACEHOLDER_ONLY },
  경북: { ...GUGUN_PLACEHOLDER_ONLY },
  광주: { ...GUGUN_PLACEHOLDER_ONLY },
  대구: { ...GUGUN_PLACEHOLDER_ONLY },
  대전: { ...GUGUN_PLACEHOLDER_ONLY },
  세종: { ...GUGUN_PLACEHOLDER_ONLY },
  울산: { ...GUGUN_PLACEHOLDER_ONLY },
  인천: { ...GUGUN_PLACEHOLDER_ONLY },
  전남: { ...GUGUN_PLACEHOLDER_ONLY },
  전북: { ...GUGUN_PLACEHOLDER_ONLY },
  제주: { ...GUGUN_PLACEHOLDER_ONLY },
  충남: { ...GUGUN_PLACEHOLDER_ONLY },
  충북: { ...GUGUN_PLACEHOLDER_ONLY },
  서울: {
    [PLACEHOLDER_GUGUN]: [PLACEHOLDER_EUP],
    강남구: [PLACEHOLDER_EUP, '역삼동', '논현동', '대치동'],
    강북구: [PLACEHOLDER_EUP, '미아동', '수유동'],
    송파구: [PLACEHOLDER_EUP, '잠실동', '문정동'],
  },
  경기: {
    [PLACEHOLDER_GUGUN]: [PLACEHOLDER_EUP],
    '수원시 영통구': [PLACEHOLDER_EUP, '영통동', '매탄동'],
    '성남시 분당구': [PLACEHOLDER_EUP, '정자동', '야탑동'],
    '고양시 덕양구': [PLACEHOLDER_EUP, '행신동', '화정동'],
  },
  부산: {
    [PLACEHOLDER_GUGUN]: [PLACEHOLDER_EUP],
    해운대구: [PLACEHOLDER_EUP, '우동', '재송동'],
    부산진구: [PLACEHOLDER_EUP, '부전동', '연지동'],
  },
}

const SIDO_OPTIONS = [PLACEHOLDER_SIDO, ...PREPARING_SIDO_ORDER]

type StatusKey = 'all' | 'payment_complete' | 'preparing' | 'shipped' | 'order_cancel'
const statusSteps: { key: StatusKey; label: string; icon: string; color: string }[] = [
  { key: 'all', label: '전체', icon: '', color: '#607d8b' },
  { key: 'payment_complete', label: '결제완료', icon: '', color: '#4caf50' },
  { key: 'preparing', label: '발송 준비중', icon: '', color: '#ff9800' },
  { key: 'shipped', label: '발송 완료', icon: '', color: '#e91e63' },
  { key: 'order_cancel', label: '주문 취소', icon: '', color: '#9e9e9e' },
]

// 상태 버튼 키 → 주문내역 orderStatus 문자열 매칭
const STATUS_KEY_TO_ORDER_STATUS: Record<Exclude<StatusKey, 'all'>, string> = {
  payment_complete: '결제완료',
  preparing: '발송 준비중',
  shipped: '발송 완료',
  order_cancel: '주문 취소',
}

/** 전체 현황에서만 사용: 주문 상태값 드롭다운 옵션 (value는 orderStatus 매칭용, ''=전체) */
const ALL_STATUS_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: '전체' },
  { value: '결제완료', label: '결제 완료' },
  { value: '발송 준비중', label: '발송 준비중' },
  { value: '발송 완료', label: '발송 완료' },
  { value: '주문 취소', label: '주문 취소' },
  { value: '부분 취소', label: '부분 취소' },
]

// 발송완료 하드코딩 주문 (상세 팝업에서 이미지 기준 데이터 표시)
const SHIPPED_ORDER_NO = 'P01041161391'

// JSON 기반 다중 공급사 주문 (상세 팝업 데이터)
const MULTI_SUPPLIER_ORDER_NO = 'PO1041161391'
/** 상세·목록 주문일시 (API 연동 시 동일 JSON의 orderDate) */
const MULTI_SUPPLIER_ORDER_DATE = '2026-03-19 13:59:17'

/** PO1041161391 SAP (제=대웅제약, 바=대웅바이오). 라인 끝 (공장)/(지역)은 상세 모달에서 배지로 표시 */
const PO1041161391_SAP_BY_SUPPLIER: Record<string, string> = {
  대웅제약: [
    'OTC(제): 오더(1510223871) / 납품(8012986009) / 빌링(9015844142) (공장)',
    'OTC(제): 오더(1510223871) / 납품(8013000947) / 빌링(9015867300) (지역)',
  ].join('\n'),
  대웅바이오: [
    'ETC(바): 오더(1510223889) / 납품(8012996999) / 빌링(9015859866) (지역)',
    'ETC(바): 오더(1510223870) / 납품(8012986191) / 빌링(9015841851) (지역)',
    'ETC(바): 오더(1510223872) / 납품(8012986123) / 빌링(9015889567) (지역)',
  ].join('\n'),
}

const MULTI_SUPPLIER_ORDER_ITEMS = [
  { supplier: '대웅제약', type: '전문의약품', name: '디애타민정 25mg', price: 22546, qty: 3, amount: 67638 },
  { supplier: '대웅제약', type: '일반의약품', name: '코메정 500mg', price: 11000, qty: 5, amount: 55000 },
  { supplier: '대웅제약', type: '전문의약품', name: '페브릭정 40mg', price: 18300, qty: 2, amount: 36600 },
  { supplier: '대웅제약', type: '전문의약품', name: '페브릭정 80mg', price: 18300, qty: 3, amount: 54900 },
  { supplier: '대웅제약', type: '일반의약품', name: '우루사 100mg', price: 33000, qty: 1, amount: 33000 },
  { supplier: '대웅제약', type: '전문의약품', name: '우루사정 200mg', price: 18000, qty: 20, amount: 360000 },
  { supplier: '대웅바이오', type: '전문의약품', name: '글리아티린연질캡슐 400mg', price: 42840, qty: 2, amount: 85680 },
  { supplier: '대웅바이오', type: '전문의약품', name: '디포린정 80mg', price: 44600, qty: 10, amount: 446000 },
  { supplier: '대웅바이오', type: '전문의약품', name: '디포린정 30mg', price: 13380, qty: 8, amount: 107040 },
  { supplier: '대웅바이오', type: '전문의약품', name: '베아릴드정 5mg', price: 55650, qty: 3, amount: 166950 },
  { supplier: '한올바이오파마', type: '전문의약품', name: '바노롤캡슐 300mg', price: 16200, qty: 3, amount: 48600 },
  { supplier: '한올바이오파마', type: '전문의약품', name: '엑시드정 40mg', price: 93900, qty: 5, amount: 469500 },
] as const
const MULTI_SUPPLIER_ORDER_TOTAL = MULTI_SUPPLIER_ORDER_ITEMS.reduce((s, i) => s + i.amount, 0)

/** P010414168713: 공급사 2곳(대웅제약·대웅바이오) 주문 */
const DUAL_SUPPLIER_ORDER_NO = 'P010414168713'
const DUAL_SUPPLIER_ORDER_DATE = '2026-03-21 11:30:00'
const DUAL_SUPPLIER_ORDER_ITEMS = [
  { supplier: '대웅제약', type: '전문의약품', name: '아모잘란정 5mg', price: 12500, qty: 2, amount: 25000 },
  { supplier: '대웅제약', type: '일반의약품', name: '탁센 연질캡슐', price: 9800, qty: 2, amount: 19600 },
  { supplier: '대웅바이오', type: '전문의약품', name: '메가바이오캡슐 200mg', price: 31500, qty: 1, amount: 31500 },
] as const
const DUAL_SUPPLIER_ORDER_TOTAL = DUAL_SUPPLIER_ORDER_ITEMS.reduce((s, i) => s + i.amount, 0)
const DUAL_SUPPLIER_SAP_BY_SUPPLIER: Record<string, string> = {
  대웅제약:
    'OTC(제): 오더(1710333001) / 납품(8014001001) / 빌링(9016001001) (공장)',
  대웅바이오:
    'ETC(바): 오더(1710333002) / 납품(8014002002) / 빌링(9016002002) (지역)',
}

const mockOrders = [
  {
    id: 0,
    orderNo: SHIPPED_ORDER_NO,
    supplier: '대웅제약',
    productName: '니베타민성/37,5밀리그램/28성 1 (PTP) 외',
    pharmacyName: '가람약국',
    customerName: '신혜선',
    memberPaymentMethod: '선결제회원',
    orderAmount: 1931058,
    salesAmount: 1931058,
    supplyAmount: 1755507,
    tax: 175551,
    paymentAmount: 1896299,
    finalAmount: 0,
    paymentMethod: '예치금',
    orderDateTime: '2026-02-06 14:49:30',
    paymentDateTime: '2026-02-06 16:20:00',
    shippedCompleteDateTime: '2026-02-10 11:30:00',
    orderStatus: '발송 완료',
    memo: '',
    memberId: 'grpharm',
    userKey: 'grpharm',
    businessNo: '104-05-47262',
  },
  {
    id: 1,
    orderNo: 'P01041416872',
    supplier: '대표제약',
    productName: '빵보뜨테스트',
    pharmacyName: '메디칼수약국',
    customerName: '테스트고객',
    memberPaymentMethod: '선결제',
    orderAmount: 46300,
    salesAmount: 46300,
    supplyAmount: 42091,
    tax: 4209,
    paymentAmount: 45467,
    finalAmount: 45467,
    paymentMethod: '신한카드BATCH결제',
    orderDateTime: '2026-03-16 09:44:58',
    paymentDateTime: '2026-03-16 09:45:00',
    shippedCompleteDateTime: '2026-03-16 14:00:00',
    orderStatus: '발송 완료',
    memo: 'N',
    memberId: 'test01',
    userKey: 'test01',
    businessNo: '120-86-00011',
  },
  {
    id: 2,
    orderNo: MULTI_SUPPLIER_ORDER_NO,
    supplier: '대웅제약',
    productName: '디애타민정 25mg 외',
    pharmacyName: '가람약국',
    customerName: '신혜선',
    memberPaymentMethod: '선결제회원',
    orderAmount: MULTI_SUPPLIER_ORDER_TOTAL,
    salesAmount: MULTI_SUPPLIER_ORDER_TOTAL,
    supplyAmount: Math.floor(MULTI_SUPPLIER_ORDER_TOTAL * 0.91),
    tax: Math.floor(MULTI_SUPPLIER_ORDER_TOTAL * 0.09),
    paymentAmount: MULTI_SUPPLIER_ORDER_TOTAL,
    finalAmount: 0,
    paymentMethod: '예치금',
    orderDateTime: MULTI_SUPPLIER_ORDER_DATE,
    paymentDateTime: MULTI_SUPPLIER_ORDER_DATE,
    shippedCompleteDateTime: MULTI_SUPPLIER_ORDER_DATE,
    orderStatus: '결제완료',
    memo: '',
    memberId: 'grpharm',
    userKey: 'grpharm',
    businessNo: '104-05-47262',
  },
  ...Array.from({ length: 10 }, (_, i) => {
    const statuses: string[] = ['주문 완료', '주문 완료', '주문 완료', '결제완료', '결제완료', '결제완료', '결제완료', '발송 준비중', '발송 준비중', '발송 준비중']
    const regions = [
      { deliverySido: '서울' as const, deliveryGugun: '강남구', deliveryEup: '역삼동' },
      { deliverySido: '경기' as const, deliveryGugun: '수원시 영통구', deliveryEup: '영통동' },
      { deliverySido: '부산' as const, deliveryGugun: '해운대구', deliveryEup: '우동' },
    ]
    const r = regions[i % 3]
    const isPreparing = statuses[i] === '발송 준비중'
    return {
      id: i + 3,
      orderNo: `P0104141687${8 + i}`,
      supplier: ['대표제약', '다원약품', '대웅제약'][i % 3],
      productName: `상품${i + 1}`,
      pharmacyName: ['성산약국', '원엔젤약국', '메디칼수약국'][i % 3],
      customerName: '고객' + (i + 1),
      memberPaymentMethod: '선결제',
      orderAmount: 15000 + i * 1000,
      salesAmount: 15000 + i * 1000,
      supplyAmount: 13000 + i * 900,
      tax: 2000 + i * 100,
      paymentAmount: 15000 + i * 1000,
      finalAmount: 15000 + i * 1000,
      paymentMethod: '세메세데',
      orderDateTime: '2026-03-16 10:00:00',
      orderStatus: statuses[i],
      memo: 'N',
      memberId: `user${i + 2}`,
      userKey: `user${i + 2}`,
      businessNo: '120-86-00011',
      ...(isPreparing ? { deliverySido: r.deliverySido, deliveryGugun: r.deliveryGugun, deliveryEup: r.deliveryEup } : {}),
    }
  }),
  {
    id: 13,
    orderNo: DUAL_SUPPLIER_ORDER_NO,
    supplier: '대웅제약',
    productName: '아모잘란정 5mg 외',
    pharmacyName: '성심약국',
    customerName: '김고객',
    memberPaymentMethod: '선결제',
    orderAmount: DUAL_SUPPLIER_ORDER_TOTAL,
    salesAmount: DUAL_SUPPLIER_ORDER_TOTAL,
    supplyAmount: Math.floor(DUAL_SUPPLIER_ORDER_TOTAL * 0.91),
    tax: Math.floor(DUAL_SUPPLIER_ORDER_TOTAL * 0.09),
    paymentAmount: DUAL_SUPPLIER_ORDER_TOTAL,
    finalAmount: 0,
    paymentMethod: '예치금',
    orderDateTime: DUAL_SUPPLIER_ORDER_DATE,
    paymentDateTime: DUAL_SUPPLIER_ORDER_DATE,
    shippedCompleteDateTime: DUAL_SUPPLIER_ORDER_DATE,
    orderStatus: '결제완료',
    memo: '',
    memberId: 'pharm02',
    userKey: 'pharm02',
    businessNo: '123-45-67890',
  },
]

function formatDate(d: Date) {
  return d.toISOString().slice(0, 10)
}

type OrderRow = (typeof mockOrders)[number]

function hashStringToInt(s: string): number {
  // stable pseudo-hash (0 ~ 2^32-1)
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0
  }
  return h
}

function bundleOrders(rows: OrderRow[]): OrderRow[] {
  // "묶음주문기준" 모의 구현:
  // - 같은 상태/주문일자/공급사/약국(+배송지역)이면 1개의 묶음으로 집계
  type Agg = {
    base: OrderRow
    orderAmount: number
    salesAmount: number
    supplyAmount: number
    tax: number
    paymentAmount: number
    finalAmount: number
  }

  const byKey = new Map<string, Agg>()
  rows.forEach((r) => {
    const orderDate = r.orderDateTime.slice(0, 10)
    const deliverySido = (r as any).deliverySido ?? ''
    const deliveryGugun = (r as any).deliveryGugun ?? ''
    const deliveryEup = (r as any).deliveryEup ?? ''
    const key = `${r.orderStatus}|${orderDate}|${r.supplier}|${r.pharmacyName}|${deliverySido}|${deliveryGugun}|${deliveryEup}`
    const existing = byKey.get(key)
    if (!existing) {
      byKey.set(key, {
        base: r,
        orderAmount: r.orderAmount,
        salesAmount: r.salesAmount,
        supplyAmount: r.supplyAmount,
        tax: r.tax,
        paymentAmount: r.paymentAmount,
        finalAmount: r.finalAmount,
      })
      return
    }
    existing.orderAmount += r.orderAmount
    existing.salesAmount += r.salesAmount
    existing.supplyAmount += r.supplyAmount
    existing.tax += r.tax
    existing.paymentAmount += r.paymentAmount
    existing.finalAmount += r.finalAmount
  })

  return Array.from(byKey.entries()).map(([key, a]) => ({
    ...a.base,
    id: hashStringToInt(key),
    orderAmount: a.orderAmount,
    salesAmount: a.salesAmount,
    supplyAmount: a.supplyAmount,
    tax: a.tax,
    paymentAmount: a.paymentAmount,
    finalAmount: a.finalAmount,
  }))
}

/** 주문일시 기준 최신순(내림차순). 동일 시각이면 주문번호로 보조 정렬 */
function sortOrdersByLatest(rows: OrderRow[]): OrderRow[] {
  return [...rows].sort((a, b) => {
    const byDt = b.orderDateTime.localeCompare(a.orderDateTime)
    if (byDt !== 0) return byDt
    return String(b.orderNo).localeCompare(String(a.orderNo))
  })
}

function getOrderDetail(row: OrderRow): OrderDetailData {
  if (row.orderNo === MULTI_SUPPLIER_ORDER_NO) {
    const orderWhen = MULTI_SUPPLIER_ORDER_DATE
    const datePart = orderWhen.slice(0, 10)
    const sapOrderNoBySupplier = PO1041161391_SAP_BY_SUPPLIER
    const sapShipmentTypeBySupplier: Record<string, '지역' | '공장'> = {
      대웅제약: '공장',
      대웅바이오: '지역',
    }
    const sapCategoryBySupplier: Record<string, 'OTC' | 'ETC'> = {
      대웅제약: 'OTC',
      대웅바이오: 'ETC',
      한올바이오파마: 'ETC',
    }
    const daewongBioRowCount = MULTI_SUPPLIER_ORDER_ITEMS.filter((i) => i.supplier === '대웅바이오').length
    let daewongPharmaIdx = 0
    let daewongBioIdx = 0
    const products = MULTI_SUPPLIER_ORDER_ITEMS.map((item) => {
      const base = {
        supplierName: item.supplier,
        expectedDeliveryDate: datePart,
        category: item.type,
        productSpec: item.name,
        manufacturer: `${item.supplier}(주)`,
        sellingPrice: `${item.price.toLocaleString()}원`,
        orderQty: String(item.qty),
        subtotal: `${item.amount.toLocaleString()}원`,
        shippingCost: '0원' as const,
      }
      if (item.supplier === '대웅제약') {
        const idx = daewongPharmaIdx
        daewongPharmaIdx += 1
        let shipmentCell: { badge: '공장' | '지역'; rowSpan?: number } | 'omit' | undefined
        if (idx === 0) shipmentCell = { badge: '공장' }
        else if (idx === 1) shipmentCell = { badge: '지역', rowSpan: 5 }
        else if (idx >= 2 && idx <= 5) shipmentCell = 'omit'
        else shipmentCell = undefined
        return {
          ...base,
          shipmentType: idx === 0 ? ('제약공장 출하' as const) : ('지역공장 출하' as const),
          shipmentCell,
        }
      }
      if (item.supplier === '대웅바이오') {
        const idx = daewongBioIdx
        daewongBioIdx += 1
        const shipmentCell =
          idx === 0
            ? { badge: '지역' as const, rowSpan: daewongBioRowCount }
            : ('omit' as const)
        return {
          ...base,
          shipmentType: '지역공장 출하' as const,
          shipmentCell,
        }
      }
      return base
    })
    const supplierTotals = MULTI_SUPPLIER_ORDER_ITEMS.reduce<Record<string, number>>((acc, item) => {
      acc[item.supplier] = (acc[item.supplier] ?? 0) + item.amount
      return acc
    }, {})
    const supplierSummary = Object.entries(supplierTotals).map(([supplier, totalAmount]) => ({
      supplier,
      totalAmount: `${totalAmount.toLocaleString()}원`,
      shippingCost: '0원',
      otcDiscount: '0원',
      costDiscount: '0원',
      mileageUsed: '0원',
    }))
    return {
      orderNo: MULTI_SUPPLIER_ORDER_NO,
      sapOrderNo: Object.values(sapOrderNoBySupplier).join('\n'),
      sapOrderNoBySupplier,
      sapShipmentTypeBySupplier,
      sapCategoryBySupplier,
      supplierDeliverySlots: {
        대웅제약: {
          factory: '2026-3-19 오후6시',
          region: '2026-3-15 오후1시',
        },
        대웅바이오: {
          region: '2026-3-18 오후1시',
        },
        한올바이오파마: {
          simple: '2026-03-19 오후1시',
        },
      },
      orderDateTime: orderWhen,
      orderStatus: '결제완료',
      orderStatusDate: orderWhen,
      totalOrderAmount: MULTI_SUPPLIER_ORDER_TOTAL,
      orderIdEmail: 'grpharm / grpharm@example.com',
      paymentMethod: '예치금',
      products,
      supplierSummary,
      paymentSummary: [
        {
          minusBalance: '0원',
          supplierCoupon: '0원',
          paymentAmount: `${MULTI_SUPPLIER_ORDER_TOTAL.toLocaleString()}원`,
          earnedMileage: '0원',
          expectedDeposit: '0원',
        },
      ],
      customer: {
        recipient: '가람약국 (신혜선)',
        contact: '031-557-5050 / 010-5699-8647',
        businessNo: '104-05-47262',
        medicalCode: '31894721',
        address: '(12260) 경기도 남양주시 도농로 1(도농동) 53-4',
      },
      vendorMessage: '',
      adminMemos: [],
    }
  }

  if (row.orderNo === DUAL_SUPPLIER_ORDER_NO) {
    const orderWhen = DUAL_SUPPLIER_ORDER_DATE
    const datePart = orderWhen.slice(0, 10)
    const sapOrderNoBySupplier = DUAL_SUPPLIER_SAP_BY_SUPPLIER
    const sapShipmentTypeBySupplier: Record<string, '지역' | '공장'> = {
      대웅제약: '공장',
      대웅바이오: '지역',
    }
    const sapCategoryBySupplier: Record<string, 'OTC' | 'ETC'> = {
      대웅제약: 'OTC',
      대웅바이오: 'ETC',
    }
    const daewongBioRowCount = DUAL_SUPPLIER_ORDER_ITEMS.filter((i) => i.supplier === '대웅바이오').length
    let daewongPharmaIdx = 0
    let daewongBioIdx = 0
    const products = DUAL_SUPPLIER_ORDER_ITEMS.map((item) => {
      const base = {
        supplierName: item.supplier,
        expectedDeliveryDate: datePart,
        category: item.type,
        productSpec: item.name,
        manufacturer: `${item.supplier}(주)`,
        sellingPrice: `${item.price.toLocaleString()}원`,
        orderQty: String(item.qty),
        subtotal: `${item.amount.toLocaleString()}원`,
        shippingCost: '0원' as const,
      }
      if (item.supplier === '대웅제약') {
        const idx = daewongPharmaIdx
        daewongPharmaIdx += 1
        let shipmentCell: { badge: '공장' | '지역'; rowSpan?: number } | 'omit' | undefined
        if (idx === 0) shipmentCell = { badge: '공장' }
        else shipmentCell = { badge: '지역' }
        return {
          ...base,
          shipmentType: idx === 0 ? ('제약공장 출하' as const) : ('지역공장 출하' as const),
          shipmentCell,
        }
      }
      if (item.supplier === '대웅바이오') {
        const idx = daewongBioIdx
        daewongBioIdx += 1
        const shipmentCell =
          idx === 0
            ? { badge: '지역' as const, rowSpan: daewongBioRowCount }
            : ('omit' as const)
        return {
          ...base,
          shipmentType: '지역공장 출하' as const,
          shipmentCell,
        }
      }
      return base
    })
    const supplierTotals = DUAL_SUPPLIER_ORDER_ITEMS.reduce<Record<string, number>>((acc, item) => {
      acc[item.supplier] = (acc[item.supplier] ?? 0) + item.amount
      return acc
    }, {})
    const supplierSummary = Object.entries(supplierTotals).map(([supplier, totalAmount]) => ({
      supplier,
      totalAmount: `${totalAmount.toLocaleString()}원`,
      shippingCost: '0원',
      otcDiscount: '0원',
      costDiscount: '0원',
      mileageUsed: '0원',
    }))
    return {
      orderNo: DUAL_SUPPLIER_ORDER_NO,
      sapOrderNo: Object.values(sapOrderNoBySupplier).join('\n'),
      sapOrderNoBySupplier,
      sapShipmentTypeBySupplier,
      sapCategoryBySupplier,
      supplierDeliverySlots: {
        대웅제약: {
          factory: '2026-3-22 오후 2시',
          region: '2026-3-20 오후 1시',
        },
        대웅바이오: {
          region: '2026-3-21 오후 3시',
        },
      },
      orderDateTime: orderWhen,
      orderStatus: '결제완료',
      orderStatusDate: orderWhen,
      totalOrderAmount: DUAL_SUPPLIER_ORDER_TOTAL,
      orderIdEmail: 'pharm02 / pharm02@example.com',
      paymentMethod: '예치금',
      products,
      supplierSummary,
      paymentSummary: [
        {
          minusBalance: '0원',
          supplierCoupon: '0원',
          paymentAmount: `${DUAL_SUPPLIER_ORDER_TOTAL.toLocaleString()}원`,
          earnedMileage: '0원',
          expectedDeposit: '0원',
        },
      ],
      customer: {
        recipient: '성심약국 (김고객)',
        contact: '02-1234-5678 / 010-2222-3333',
        businessNo: '123-45-67890',
        medicalCode: '31112233',
        address: '(04567) 서울특별시 중구 세종대로 110',
      },
      vendorMessage: '',
      adminMemos: [],
    }
  }

  if (row.orderNo === SHIPPED_ORDER_NO) {
    const sapLines = [
      `OTC(제): 오더(1510223871) / 납품(8012986009) / 빌링(9015844142) / ([거점] 김포이지메디컴)(출하완료)`,
      `OTC: 오더(1510223871) / 납품(8013003947) / 빌링(9015867300) / (향남 제품,상품_향정)(출하완료)`,
      `ETC(바): 오더(1510223869) / 납품(8012996999) / 빌링(9015859566) / (안성공장 제품/상품 마약)(출하완료)`,
    ]
    const sapOrderNoBySupplier: Record<string, string> = {
      대웅제약: sapLines[0],
      대웅바이오: sapLines[1],
      한올바이오파마: sapLines[2],
    }
    const sapShipmentTypeBySupplier: Record<string, '지역' | '공장'> = {
      대웅제약: '지역',
      대웅바이오: '공장',
      한올바이오파마: '공장',
    }
    const sapCategoryBySupplier: Record<string, 'OTC' | 'ETC'> = {
      대웅제약: 'OTC',
      대웅바이오: 'OTC',
      한올바이오파마: 'ETC',
    }
    return {
      orderNo: 'P01041161391',
      sapOrderNo: sapLines.join('\n'),
      sapOrderNoBySupplier,
      sapShipmentTypeBySupplier,
      sapCategoryBySupplier,
      orderDateTime: '2026-02-06 14:49:30',
      orderStatus: '발송 완료',
      orderStatusDate: '2026-02-06 14:49:30',
      totalOrderAmount: 1931058,
      orderIdEmail: 'grpharm / grpharm@example.com',
      paymentMethod: '예치금',
      products: [
        // 대웅제약 6종 (지역공장 출하)
        { supplierName: '대웅제약', expectedDeliveryDate: '2026-02-10', category: '전문의약품', productSpec: '니베타민성/37,5밀리그램/28성 1 (PTP)', manufacturer: '(주)대웅제약', sellingPrice: '101,288원', orderQty: '1', subtotal: '101,288원', shippingCost: '0원', shipmentType: '지역공장 출하' },
        { supplierName: '대웅제약', expectedDeliveryDate: '2026-02-10', category: '전문의약품', productSpec: '모바렌 5%폼에어로솔/60g/1캔', manufacturer: '(주)대웅제약', sellingPrice: '98,000원', orderQty: '1', subtotal: '98,000원', shippingCost: '0원', shipmentType: '지역공장 출하' },
        { supplierName: '대웅제약', expectedDeliveryDate: '2026-02-10', category: '전문의약품', productSpec: '타이레놀정500밀리그램', manufacturer: '(주)대웅제약', sellingPrice: '95,000원', orderQty: '1', subtotal: '95,000원', shippingCost: '0원', shipmentType: '지역공장 출하' },
        { supplierName: '대웅제약', expectedDeliveryDate: '2026-02-10', category: '전문의약품', productSpec: '캡시플정0.075밀리그램', manufacturer: '(주)대웅제약', sellingPrice: '102,000원', orderQty: '1', subtotal: '102,000원', shippingCost: '0원', shipmentType: '지역공장 출하' },
        { supplierName: '대웅제약', expectedDeliveryDate: '2026-02-10', category: '전문의약품', productSpec: '가스디알정20밀리그램', manufacturer: '(주)대웅제약', sellingPrice: '108,000원', orderQty: '1', subtotal: '108,000원', shippingCost: '0원', shipmentType: '지역공장 출하' },
        { supplierName: '대웅제약', expectedDeliveryDate: '2026-02-10', category: '전문의약품', productSpec: '우루사캡슐100밀리그램', manufacturer: '(주)대웅제약', sellingPrice: '103,000원', orderQty: '1', subtotal: '103,000원', shippingCost: '0원', shipmentType: '지역공장 출하' },
        // 대웅바이오 4종 (제약공장 출하)
        { supplierName: '대웅바이오', expectedDeliveryDate: '2026-02-10', category: '일반의약품', productSpec: '글리아타민 연질캡슐/400밀리그램/90캡슐 (PTP)', manufacturer: '대웅바이오(주)', sellingPrice: '225,000원', orderQty: '1', subtotal: '225,000원', shippingCost: '0원', shipmentType: '제약공장 출하' },
        { supplierName: '대웅바이오', expectedDeliveryDate: '2026-02-10', category: '일반의약품', productSpec: '글리아타민 연질캡슐/400밀리그램/30캡슐 (PTP)', manufacturer: '대웅바이오(주)', sellingPrice: '195,168원', orderQty: '1', subtotal: '195,168원', shippingCost: '0원', shipmentType: '제약공장 출하' },
        { supplierName: '대웅바이오', expectedDeliveryDate: '2026-02-10', category: '일반의약품', productSpec: '엔빌정5밀리그램', manufacturer: '대웅바이오(주)', sellingPrice: '192,751원', orderQty: '1', subtotal: '192,751원', shippingCost: '0원', shipmentType: '제약공장 출하' },
        { supplierName: '대웅바이오', expectedDeliveryDate: '2026-02-10', category: '일반의약품', productSpec: '바이타민정', manufacturer: '대웅바이오(주)', sellingPrice: '192,751원', orderQty: '1', subtotal: '192,751원', shippingCost: '0원', shipmentType: '제약공장 출하' },
        // 한올바이오파마 2종 (제약공장 출하)
        { supplierName: '한올바이오파마', expectedDeliveryDate: '2026-02-07', category: '전문의약품', productSpec: '베노론캡슐/300밀리그램/100캡슐 (병)', manufacturer: '한올바이오파마(주)', sellingPrice: '259,050원', orderQty: '1', subtotal: '259,050원', shippingCost: '0원', shipmentType: '제약공장 출하' },
        { supplierName: '한올바이오파마', expectedDeliveryDate: '2026-02-07', category: '전문의약품', productSpec: '베노론캡슐/300밀리그램/30캡슐 (PTP)', manufacturer: '한올바이오파마(주)', sellingPrice: '259,050원', orderQty: '1', subtotal: '259,050원', shippingCost: '0원', shipmentType: '제약공장 출하' },
      ],
      supplierSummary: [
        { supplier: '대웅제약', totalAmount: '607,288원', shippingCost: '0원', otcDiscount: '0원', costDiscount: '10,931원', mileageUsed: '0원' },
        { supplier: '대웅바이오', totalAmount: '805,670원', shippingCost: '0원', otcDiscount: '0원', costDiscount: '14,502원', mileageUsed: '0원' },
        { supplier: '한올바이오파마', totalAmount: '518,100원', shippingCost: '0원', otcDiscount: '0원', costDiscount: '9,326원', mileageUsed: '0원' },
      ],
      paymentSummary: [
        { minusBalance: '0원', supplierCoupon: '0원', paymentAmount: '1,896,299원', earnedMileage: '0원', expectedDeposit: '0원' },
      ],
      customer: {
        recipient: '가람약국 (신혜선)',
        contact: '031-557-5050 / 010-5699-8647',
        businessNo: '104-05-47262',
        medicalCode: '31894721',
        address: '(12260) 경기도 남양주시 도농로 1(도농동) 53-4',
      },
      vendorMessage: '발송 완료 건 배송 추적 확인 부탁드립니다.',
      adminMemos: [
        { id: '1', authorName: '관리자1', content: '배송 일정 확인 부탁드립니다.' },
        { id: '2', authorName: '운영팀김철수', content: '확인했습니다. 발송 완료 처리되었습니다.' },
      ],
    }
  }

  const [datePart] = row.orderDateTime.split(' ')
  const sapTargets = ['대웅제약', '대웅바이오', '한올바이오파마']
  const singleSap = row.orderNo.replace(/^P/, 'SAP') || '-'
  const sapOrderNoBySupplier =
    sapTargets.includes(row.supplier) ? { [row.supplier]: singleSap } : undefined
  return {
    orderNo: row.orderNo,
    sapOrderNo: singleSap,
    sapOrderNoBySupplier,
    orderDateTime: row.orderDateTime,
    orderStatus: row.orderStatus,
    orderStatusDate: row.orderDateTime,
    totalOrderAmount: row.orderAmount,
    orderIdEmail: `${row.memberId} / ${row.memberId}@example.com`,
    paymentMethod: row.paymentMethod,
    products: [
      {
        supplierName: `${row.supplier} (도매)`,
        expectedDeliveryDate: datePart,
        category: `전문의약품 ${1003432349 + row.id}`,
        productSpec: `${row.productName}/ea/ea`,
        manufacturer: `${row.supplier}_제조사`,
        sellingPrice: `${(row.orderAmount / 10).toLocaleString()}원`,
        orderQty: '10개',
        subtotal: `${row.orderAmount.toLocaleString()}원`,
        shippingCost: '0원',
        shipmentType: sapTargets.includes(row.supplier) ? '제약공장 출하' : undefined,
      },
    ],
    supplierSummary: [
      {
        supplier: `${row.supplier} (도매)`,
        totalAmount: `${row.orderAmount.toLocaleString()}원`,
        shippingCost: '0원',
        otcDiscount: '0원',
        costDiscount: '540원',
        mileageUsed: '0원',
      },
    ],
    paymentSummary: [
      {
        minusBalance: '0원',
        supplierCoupon: '0원',
        paymentAmount: `${row.paymentAmount.toLocaleString()}원`,
        earnedMileage: '0원',
        expectedDeposit: '0원',
      },
    ],
    customer: {
      recipient: `${row.pharmacyName} (가입자명 : ${row.customerName} / 대표자명 : ${row.customerName})`,
      contact: '02-111-1112 / 010-3468-6450',
      businessNo: '120-86-00011',
      medicalCode: String(98498494 + row.id),
      address: '(25258) 강원특별자치도 횡성군 갑천면 갑천로 9-4 테스트',
    },
    vendorMessage: `${row.supplier} (도매) 메세지`,
    adminMemos: [
      { id: '1', authorName: '관리자1', content: '배송 일정 확인 부탁드립니다.' },
      { id: '2', authorName: '운영팀김철수', content: '확인했습니다. 내일 발송 예정입니다.' },
    ],
  }
}

/** 상품 소계 문자열 → 숫자(원) */
function parseSubtotalWon(s: string | undefined): number {
  if (!s) return 0
  const n = parseInt(String(s).replace(/[,\s원]/g, ''), 10)
  return Number.isNaN(n) ? 0 : n
}

/** 주문내역 테이블 1행 (공급사 분할 시 여러 줄) */
type OrderTableLine = {
  key: string
  baseRow: OrderRow
  detail: OrderDetailData
  lineIndex: number
  rowspan: number
  supplierDisplay: string
  supplierStatus: string
  productSummary: string
  supplierOrderAmount: number
  supplierSalesAmount: number
  supplierSupply: number
  supplierTax: number
}

function buildOrderTableLines(row: OrderRow): OrderTableLine[] {
  const detail = getOrderDetail(row)
  const byKey = new Map<string, OrderDetailData['products']>()
  for (const p of detail.products) {
    const k = normalizeSupplierForSap(p.supplierName)
    if (!byKey.has(k)) byKey.set(k, [])
    byKey.get(k)!.push(p)
  }
  const keys = [...byKey.keys()]

  if (keys.length <= 1) {
    const prods = keys.length === 1 ? byKey.get(keys[0])! : detail.products
    const displayName = prods[0]?.supplierName ?? row.supplier
    return [
      {
        key: `${row.id}-0`,
        baseRow: row,
        detail,
        lineIndex: 0,
        rowspan: 1,
        supplierDisplay: row.supplier,
        supplierStatus: getSupplierOrderStatusFromSap({
          sapOrderNoBySupplier: detail.sapOrderNoBySupplier,
          supplierName: displayName,
          fallbackOrderStatus: row.orderStatus,
        }),
        productSummary: row.productName,
        supplierOrderAmount: row.orderAmount,
        supplierSalesAmount: row.salesAmount,
        supplierSupply: row.supplyAmount,
        supplierTax: row.tax,
      },
    ]
  }

  const rowspan = keys.length
  return keys.map((k, lineIndex) => {
    const prods = byKey.get(k)!
    const displayName = prods[0]?.supplierName ?? k
    const sum = prods.reduce((s, p) => s + parseSubtotalWon(p.subtotal), 0)
    const ratio = row.orderAmount > 0 ? sum / row.orderAmount : 0
    const firstSpec = (prods[0]?.productSpec ?? prods[0]?.category ?? '—').trim()
    const shortName = firstSpec.length > 36 ? `${firstSpec.slice(0, 36)}…` : firstSpec
    const productSummary =
      prods.length > 1 ? `${shortName} 외 ${prods.length - 1}건` : shortName

    return {
      key: `${row.id}-${lineIndex}`,
      baseRow: row,
      detail,
      lineIndex,
      rowspan,
      supplierDisplay: displayName,
      supplierStatus: getSupplierOrderStatusFromSap({
        sapOrderNoBySupplier: detail.sapOrderNoBySupplier,
        supplierName: k,
        fallbackOrderStatus: row.orderStatus,
      }),
      productSummary,
      supplierOrderAmount: sum,
      supplierSalesAmount: Math.round(row.salesAmount * ratio),
      supplierSupply: Math.round(row.supplyAmount * ratio),
      supplierTax: Math.round(row.tax * ratio),
    }
  })
}

const EXCEL_HEADERS = [
  '주문번호', '공급처', '상품명', '약국명', '고객명', '회원결제방식',
  '주문금액', '매출액', '공급가액', '부가세', '결제금액', '최종결제금액',
  '결제방식', '주문일시', '주문상태', '메모', '회원ID',
]

function downloadOrderExcel(orders: OrderRow[]) {
  const rows = orders.flatMap((row) => {
    const lines = buildOrderTableLines(row)
    return lines.map((line) => [
      row.orderNo,
      line.supplierDisplay,
      line.productSummary,
      row.pharmacyName,
      row.customerName,
      row.memberPaymentMethod,
      line.supplierOrderAmount,
      line.supplierSalesAmount,
      line.supplierSupply,
      line.supplierTax,
      row.paymentAmount,
      row.finalAmount,
      row.paymentMethod,
      row.orderDateTime,
      line.supplierStatus,
      row.memo,
      row.memberId,
    ])
  })
  const data = [EXCEL_HEADERS, ...rows]
  const ws = XLSX.utils.aoa_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '주문내역')
  const fileName = `주문내역_${new Date().toISOString().slice(0, 10)}.xlsx`
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
}

export default function OrderStatus() {
  const today = new Date()
  const initialDateTo = formatDate(today)
  const initialDateFrom = formatDate(today)
  const [tab, setTab] = useState<'order' | 'bundle'>('order')
  const [dateFrom, setDateFrom] = useState(initialDateFrom)
  const [dateTo, setDateTo] = useState(initialDateTo)
  const [activeStatus, setActiveStatus] = useState<StatusKey>('all')
  type DateRange = { from: string; to: string }
  const [dateRangeByStatus, setDateRangeByStatus] = useState<Record<StatusKey, DateRange>>(() => ({
    all: { from: initialDateFrom, to: initialDateTo },
    payment_complete: { from: initialDateFrom, to: initialDateTo },
    preparing: { from: initialDateFrom, to: initialDateTo },
    shipped: { from: initialDateFrom, to: initialDateTo },
    order_cancel: { from: initialDateFrom, to: initialDateTo },
  }))
  const [plusExclusiveY, setPlusExclusiveY] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [detailOpen, setDetailOpen] = useState<OrderDetailData | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  /** 주문번호별 상태 오버라이드 (주문 취소 버튼 등으로 변경된 상태) */
  const [orderStatusOverrides, setOrderStatusOverrides] = useState<Record<string, string>>({})
  /** 검색 초기화 후 재조회 실패 여부 알럿 처리용 */
  const [resetNonce, setResetNonce] = useState(0)

  const [supplier, setSupplier] = useState(supplierOptions[0])
  const [searchType2, setSearchType2] = useState('약국명')
  const [searchKeyword2, setSearchKeyword2] = useState('')
  type DepositScope = '전체' | '구매' | '제외'
  type DepositIncludeMode = '포함' | '미포함'
  const [depositScope, setDepositScope] = useState<DepositScope>('전체')
  const [depositIncludeMode, setDepositIncludeMode] = useState<DepositIncludeMode>('포함')
  const [deliverySido, setDeliverySido] = useState(PLACEHOLDER_SIDO)
  const [deliveryGugun, setDeliveryGugun] = useState(PLACEHOLDER_GUGUN)
  const [deliveryEup, setDeliveryEup] = useState(PLACEHOLDER_EUP)
  /** 발송완료 현황: 기간 기준 (기본 주문일자) */
  const [shippedDateBasis, setShippedDateBasis] = useState<'order' | 'payment' | 'shipped'>('order')
  /** 전체 현황에서만: 주문 상태값 필터 ('')=전체 */
  const [allStatusFilter, setAllStatusFilter] = useState('')

  const dateRangeError = (() => {
    if (!dateFrom || !dateTo) return '조회 기간을 올바르게 입력해주세요.'
    if (dateFrom > dateTo) return '시작일은 종료일보다 늦을 수 없습니다.'
    return ''
  })()

  const lastDateErrorAlertKeyRef = useRef<string>('')
  useEffect(() => {
    const shouldAlert = dateRangeError === '시작일은 종료일보다 늦을 수 없습니다.'
    if (!shouldAlert) return
    const key = `${dateFrom}~${dateTo}`
    if (lastDateErrorAlertKeyRef.current === key) return
    lastDateErrorAlertKeyRef.current = key
    window.alert(dateRangeError)
  }, [dateRangeError, dateFrom, dateTo])

  // 탭(주문 상태) 변경 시 해당 탭의 날짜 기본값을 UI에 반영
  useEffect(() => {
    const r = dateRangeByStatus[activeStatus]
    if (r) {
      setDateFrom(r.from)
      setDateTo(r.to)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStatus])

  const resetAllFilters = () => {
    try {
      setDateFrom(initialDateFrom)
      setDateTo(initialDateTo)
      setDateRangeByStatus((prev) => ({
        ...prev,
        [activeStatus]: { from: initialDateFrom, to: initialDateTo },
      }))
      setSupplier(supplierOptions[0])
      setSearchType2('약국명')
      setSearchKeyword2('')
      setDepositScope('전체')
      setDepositIncludeMode('포함')
      setPlusExclusiveY(false)
      setDeliverySido(PLACEHOLDER_SIDO)
      setDeliveryGugun(PLACEHOLDER_GUGUN)
      setDeliveryEup(PLACEHOLDER_EUP)
      setShippedDateBasis('order')
      setAllStatusFilter('')
      setResetNonce((n) => n + 1)
    } catch {
      window.alert('초기화 중 오류가 발생했습니다. 다시 시도해주세요.')
    }
  }

  const gugunOptions =
    deliverySido && REGION_TREE[deliverySido]
      ? [PLACEHOLDER_GUGUN, ...Object.keys(REGION_TREE[deliverySido]).filter((k) => k !== PLACEHOLDER_GUGUN)]
      : [PLACEHOLDER_GUGUN]
  const eupOptions =
    deliverySido && deliveryGugun && REGION_TREE[deliverySido]?.[deliveryGugun]
      ? REGION_TREE[deliverySido][deliveryGugun]
      : [PLACEHOLDER_EUP]

  const ordersWithOverrides: OrderRow[] = mockOrders.map((o) => ({
    ...o,
    orderStatus: orderStatusOverrides[o.orderNo] ?? o.orderStatus,
  }))

  // 선택된 상태에 따라 주문 목록 필터링 (주문내역 orderStatus와 매칭)
  let filteredOrders =
    activeStatus === 'all'
      ? ordersWithOverrides
      : ordersWithOverrides.filter((order) => order.orderStatus === STATUS_KEY_TO_ORDER_STATUS[activeStatus])

  if (activeStatus === 'all' && allStatusFilter !== '') {
    filteredOrders = filteredOrders.filter((order) => order.orderStatus === allStatusFilter)
  }

  if (activeStatus === 'preparing') {
    type RowWithRegion = OrderRow & { deliverySido?: string; deliveryGugun?: string; deliveryEup?: string }
    if (deliverySido !== PLACEHOLDER_SIDO) {
      filteredOrders = filteredOrders.filter((o) => (o as RowWithRegion).deliverySido === deliverySido)
    }
    if (deliveryGugun !== PLACEHOLDER_GUGUN) {
      filteredOrders = filteredOrders.filter((o) => (o as RowWithRegion).deliveryGugun === deliveryGugun)
    }
    if (deliveryEup !== PLACEHOLDER_EUP) {
      filteredOrders = filteredOrders.filter((o) => (o as RowWithRegion).deliveryEup === deliveryEup)
    }
  }

  type RowWithShippedDates = OrderRow & {
    paymentDateTime?: string
    shippedCompleteDateTime?: string
  }
  const shippedInRange = (row: OrderRow) => {
    const r = row as RowWithShippedDates
    let d: string
    if (shippedDateBasis === 'order') {
      d = row.orderDateTime.slice(0, 10)
    } else if (shippedDateBasis === 'payment') {
      d = (r.paymentDateTime ?? row.orderDateTime).slice(0, 10)
    } else {
      d = (r.shippedCompleteDateTime ?? row.orderDateTime).slice(0, 10)
    }
    return d >= dateFrom && d <= dateTo
  }

  const orderInRange = (row: OrderRow) => {
    const d = row.orderDateTime.slice(0, 10)
    return d >= dateFrom && d <= dateTo
  }

  const orderInRangeWith = (row: OrderRow, from: string, to: string) => {
    const d = row.orderDateTime.slice(0, 10)
    return d >= from && d <= to
  }

  const shippedInRangeWith = (
    row: OrderRow,
    basis: 'order' | 'payment' | 'shipped',
    from: string,
    to: string
  ) => {
    const r = row as RowWithShippedDates
    let d: string
    if (basis === 'order') d = row.orderDateTime.slice(0, 10)
    else if (basis === 'payment') d = (r.paymentDateTime ?? row.orderDateTime).slice(0, 10)
    else d = (r.shippedCompleteDateTime ?? row.orderDateTime).slice(0, 10)
    return d >= from && d <= to
  }

  const isValidDateRange = (from: string, to: string) => !!from && !!to && from <= to

  if (dateRangeError) {
    filteredOrders = []
  } else if (activeStatus === 'shipped') {
    filteredOrders = filteredOrders.filter(shippedInRange)
  } else {
    // 기본(전체/주문완료/결제완료/준비중/주문취소 등): 주문일자 기준으로 본다
    filteredOrders = filteredOrders.filter(orderInRange)
  }

  const isDepositPayment = (row: OrderRow) => row.paymentMethod === '예치금'
  if (depositScope === '제외') {
    filteredOrders = filteredOrders.filter((o) => !isDepositPayment(o))
  } else if (depositScope === '구매') {
    filteredOrders =
      depositIncludeMode === '포함'
        ? filteredOrders.filter(isDepositPayment)
        : filteredOrders.filter((o) => !isDepositPayment(o))
  }

  // 검색타입/검색어 필터
  const keywordRaw = searchKeyword2
  const keyword = keywordRaw.trim()
  const searchKeywordError =
    keywordRaw.length > 0 && keyword.length === 0 ? '검색어를 확인해주세요.' : ''

  const isOrderNoLike = (s: string) => /^P?\d{6,}$/.test(s.replace(/\s/g, ''))
  const isBusinessNoLike = (s: string) => {
    const v = s.replace(/\s/g, '')
    return /^\d{10}$/.test(v) || /^\d{3}-\d{2}-\d{5}$/.test(v)
  }
  const isAlphaNumLike = (s: string) => /^[a-zA-Z0-9_-]+$/.test(s.replace(/\s/g, ''))

  const searchTypeMismatchError = (() => {
    if (keyword === '') return ''
    if (searchKeywordError) return ''

    if (searchType2 === '약국명' || searchType2 === '고객명' || searchType2 === '상품명') {
      if (isOrderNoLike(keyword) || isBusinessNoLike(keyword)) return '검색타입과 검색어가 일치하지 않습니다.'
      return ''
    }
    if (searchType2 === '주문번호') {
      return isOrderNoLike(keyword) ? '' : '검색타입과 검색어가 일치하지 않습니다.'
    }
    if (searchType2 === '사업자번호') {
      return isBusinessNoLike(keyword) ? '' : '검색타입과 검색어가 일치하지 않습니다.'
    }
    if (searchType2 === '회원 아이디' || searchType2 === '유저키') {
      return isAlphaNumLike(keyword) ? '' : '검색타입과 검색어가 일치하지 않습니다.'
    }
    return ''
  })()

  const lastMismatchAlertKeyRef = useRef<string>('')
  useEffect(() => {
    if (!searchTypeMismatchError) return
    if (keyword === '') return
    const key = `${searchType2}|${keyword}`
    if (lastMismatchAlertKeyRef.current === key) return
    lastMismatchAlertKeyRef.current = key
    window.alert(searchTypeMismatchError)
  }, [searchTypeMismatchError, keyword, searchType2])

  if (searchKeywordError) {
    filteredOrders = []
  } else if (searchTypeMismatchError) {
    filteredOrders = []
  } else if (keyword !== '') {
    const k = keyword.toLowerCase()
    filteredOrders = filteredOrders.filter((row) => {
      const rAny = row as any
      if (searchType2 === '약국명') return String(row.pharmacyName ?? '-').toLowerCase().includes(k)
      if (searchType2 === '주문번호') return String(row.orderNo ?? '-').toLowerCase().includes(k)
      if (searchType2 === '고객명') return String(row.customerName ?? '-').toLowerCase().includes(k)
      if (searchType2 === '상품명') return String(row.productName ?? '-').toLowerCase().includes(k)

      // 정확 검색 우선
      if (searchType2 === '회원 아이디') return String(row.memberId ?? '').toLowerCase() === k
      if (searchType2 === '유저키') return String(rAny.userKey ?? '').toLowerCase() === k
      if (searchType2 === '사업자번호') return String(rAny.businessNo ?? '').toLowerCase() === k
      return true
    })
  }

  // 묶음주문기준 적용: 목록/건수/요약/페이지네이션 재조회 기준이 되는 데이터
  // 모든 탭·묶음 여부와 관계없이 주문일시 최신순으로 표시
  const displayedOrders = sortOrdersByLatest(
    tab === 'bundle' ? bundleOrders(filteredOrders) : filteredOrders
  )

  const matchesSearch = (row: OrderRow, k: string): boolean => {
    const rAny = row as any
    if (searchType2 === '약국명') return String(row.pharmacyName ?? '-').toLowerCase().includes(k)
    if (searchType2 === '주문번호') return String(row.orderNo ?? '-').toLowerCase().includes(k)
    if (searchType2 === '고객명') return String(row.customerName ?? '-').toLowerCase().includes(k)
    if (searchType2 === '상품명') return String(row.productName ?? '-').toLowerCase().includes(k)

    // 정확 검색 우선
    if (searchType2 === '회원 아이디') return String(row.memberId ?? '').toLowerCase() === k
    if (searchType2 === '유저키') return String(rAny.userKey ?? '').toLowerCase() === k
    if (searchType2 === '사업자번호') return String(rAny.businessNo ?? '').toLowerCase() === k
    return true
  }

  // 상단 탭 건수: "검색해서 나온 주문내역" 개수 기준으로 동적 업데이트
  const countMaybeBundle = (rows: OrderRow[]) => (tab === 'bundle' ? bundleOrders(rows).length : rows.length)

  // resetNonce 직후에도 유효성 오류가 남아있으면 "재조회 실패"로 간주해 알럿 표시
  useEffect(() => {
    if (resetNonce <= 0) return
    // 이미 시작일/종료일 비교에 대한 알럿은 별도 처리 중이므로 그 케이스는 제외
    const isStartEndMismatch = dateRangeError === '시작일은 종료일보다 늦을 수 없습니다.'
    const hasFailure =
      !isStartEndMismatch && (dateRangeError !== '' || searchKeywordError !== '')
    if (hasFailure) {
      window.alert('초기화 중 오류가 발생했습니다. 다시 시도해주세요.')
    }
    setResetNonce(0)
  }, [resetNonce, dateRangeError, searchKeywordError])

  const ordersForCountsBase = (() => {
    if (searchKeywordError) return [] as OrderRow[]

    let base = ordersWithOverrides.slice()

    const keyword = searchKeyword2.trim()
    if (keyword !== '') {
      const k = keyword.toLowerCase()
      base = base.filter((r) => matchesSearch(r, k))
    }

    return base
  })()

  const allRange = dateRangeByStatus.all
  const paymentRange = dateRangeByStatus.payment_complete
  const preparingRange = dateRangeByStatus.preparing
  const shippedRange = dateRangeByStatus.shipped
  const orderCancelRange = dateRangeByStatus.order_cancel

  const ordersForAll = allStatusFilter !== '' ? ordersForCountsBase.filter((o) => o.orderStatus === allStatusFilter) : ordersForCountsBase

  // 전체 탭: 주문일자(orderDateTime) 기준으로 본다
  const allCountRows =
    isValidDateRange(allRange.from, allRange.to)
      ? ordersForAll.filter((o) => orderInRangeWith(o, allRange.from, allRange.to))
      : []
  const allCount = countMaybeBundle(allCountRows)

  const paymentRows =
    ordersForCountsBase.filter((o) => o.orderStatus === STATUS_KEY_TO_ORDER_STATUS.payment_complete) || []
  const paymentCountRows =
    isValidDateRange(paymentRange.from, paymentRange.to)
      ? paymentRows.filter((o) => orderInRangeWith(o, paymentRange.from, paymentRange.to))
      : []
  const paymentCompleteCount = countMaybeBundle(paymentCountRows)

  let preparingCountRows = ordersForCountsBase.filter((o) => o.orderStatus === STATUS_KEY_TO_ORDER_STATUS.preparing)
  if (deliverySido !== PLACEHOLDER_SIDO) {
    preparingCountRows = preparingCountRows.filter((o) => (o as any).deliverySido === deliverySido)
  }
  if (deliveryGugun !== PLACEHOLDER_GUGUN) {
    preparingCountRows = preparingCountRows.filter((o) => (o as any).deliveryGugun === deliveryGugun)
  }
  if (deliveryEup !== PLACEHOLDER_EUP) {
    preparingCountRows = preparingCountRows.filter((o) => (o as any).deliveryEup === deliveryEup)
  }
  const preparingCountRowsInDate =
    isValidDateRange(preparingRange.from, preparingRange.to)
      ? preparingCountRows.filter((o) => orderInRangeWith(o, preparingRange.from, preparingRange.to))
      : []
  const preparingCount = countMaybeBundle(preparingCountRowsInDate)

  const shippedRows = ordersForCountsBase.filter((o) => o.orderStatus === STATUS_KEY_TO_ORDER_STATUS.shipped)
  const shippedCountRowsInDate =
    isValidDateRange(shippedRange.from, shippedRange.to)
      ? shippedRows.filter((o) => shippedInRangeWith(o, shippedDateBasis, shippedRange.from, shippedRange.to))
      : []
  const shippedCount = countMaybeBundle(shippedCountRowsInDate)

  const orderCancelRows = ordersForCountsBase.filter((o) => o.orderStatus === STATUS_KEY_TO_ORDER_STATUS.order_cancel)
  const orderCancelCountRows =
    isValidDateRange(orderCancelRange.from, orderCancelRange.to)
      ? orderCancelRows.filter((o) => orderInRangeWith(o, orderCancelRange.from, orderCancelRange.to))
      : []
  const orderCancelCount = countMaybeBundle(orderCancelCountRows)

  const statusCountsForDisplay: Record<StatusKey, number> = {
    all: allCount,
    payment_complete: paymentCompleteCount,
    preparing: preparingCount,
    shipped: shippedCount,
    order_cancel: orderCancelCount,
  }

  const PAGE_SIZE = 10
  const totalPages = Math.max(1, Math.ceil(displayedOrders.length / PAGE_SIZE))
  const safePage = Math.min(currentPage, totalPages)
  const paginatedOrders = displayedOrders.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const orderTableLines = useMemo(() => {
    const slice = displayedOrders.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
    return slice.flatMap((row) => buildOrderTableLines(row))
  }, [displayedOrders, safePage])

  useEffect(() => {
    setCurrentPage(1)
  }, [
    tab,
    activeStatus,
    shippedDateBasis,
    dateFrom,
    dateTo,
    deliverySido,
    deliveryGugun,
    deliveryEup,
    allStatusFilter,
    depositScope,
    depositIncludeMode,
  ])

  useEffect(() => {
    if (currentPage > totalPages && totalPages >= 1) setCurrentPage(1)
  }, [currentPage, totalPages])

  // 선택 상태는 탭 이동 시 초기화
  useEffect(() => {
    setSelectedIds(new Set())
  }, [tab, activeStatus])

  // 검색 조건은 상태 탭 이동 시 기본값으로 초기화
  useEffect(() => {
    setSearchType2('약국명')
    setSearchKeyword2('')
    setSupplier(supplierOptions[0])
    setDepositScope('전체')
    setDepositIncludeMode('포함')
    setDeliverySido(PLACEHOLDER_SIDO)
    setDeliveryGugun(PLACEHOLDER_GUGUN)
    setDeliveryEup(PLACEHOLDER_EUP)
    setPlusExclusiveY(false)
    setAllStatusFilter('')
    setShippedDateBasis('order')
  }, [activeStatus])

  const allFilteredSelected =
    paginatedOrders.length > 0 && paginatedOrders.every((o) => selectedIds.has(o.id))
  const someFilteredSelected =
    paginatedOrders.some((o) => selectedIds.has(o.id)) && !allFilteredSelected

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      const next = new Set(selectedIds)
      paginatedOrders.forEach((o) => next.delete(o.id))
      setSelectedIds(next)
    } else {
      const next = new Set(selectedIds)
      paginatedOrders.forEach((o) => next.add(o.id))
      setSelectedIds(next)
    }
  }

  const toggleSelectOne = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const summaryOrderAmount = displayedOrders.reduce((sum, r) => sum + r.orderAmount, 0)
  const summaryFinalAmount = displayedOrders.reduce((sum, r) => sum + r.finalAmount, 0)
  // 최종결제금액 = 주문금액 - 취소금액(부분취소 포함)
  const summaryCancelAmount = Math.max(summaryOrderAmount - summaryFinalAmount, 0)

  const setQuickDate = (type: 'today' | '1day' | '1week' | '1month') => {
    const today = new Date()
    const toStr = formatDate(today)
    let from: Date
    if (type === 'today') {
      from = today
    } else if (type === '1day') {
      from = new Date(today)
      from.setDate(from.getDate() - 1)
    } else if (type === '1week') {
      from = new Date(today)
      from.setDate(from.getDate() - 6)
    } else {
      from = new Date(today)
      from.setMonth(from.getMonth() - 1)
    }
    const fromStr = formatDate(from)
    setDateFrom(fromStr)
    setDateTo(toStr)
    setDateRangeByStatus((prev) => ({
      ...prev,
      [activeStatus]: { from: fromStr, to: toStr },
    }))
  }

  return (
    <div className={styles.page}>
      <div className={styles.breadcrumb}>
        {breadcrumb.map((item, i) => (
          <span key={item}>
            {i > 0 && <span className={styles.breadcrumbSep}> &gt; </span>}
            {item}
          </span>
        ))}
      </div>
      <h1 className={styles.pageTitle}>
        주문현황
      </h1>

      <div className={styles.statusBar}>
        {statusSteps.map((step, index) => {
          const isActive = activeStatus === step.key
          const count = statusCountsForDisplay[step.key]
          const isLast = index === statusSteps.length - 1
          return (
            <div key={step.key} className={styles.statusBarInner}>
              <button
                type="button"
                className={`${styles.statusBarItem} ${isActive ? styles.statusBarItemActive : ''}`}
                onClick={() => setActiveStatus(step.key)}
              >
                {step.icon ? (
                  <span className={styles.statusBarIcon} style={{ background: step.color }}>
                    {step.icon}
                  </span>
                ) : null}
                <span className={styles.statusBarLabel}>{step.label}</span>
                <span className={`${styles.statusBarCount} ${count > 0 ? styles.statusBarCountAlert : ''}`}>
                  {count}건
                </span>
              </button>
              {!isLast && <span className={styles.statusBarArrow} aria-hidden />}
            </div>
          )
        })}
      </div>

      <CollapsibleSection title="주문현황" defaultOpen={true}>
        <div className={styles.tabs}>
          <button
            type="button"
            className={`${styles.tab} ${tab === 'order' ? styles.tabActive : ''}`}
            onClick={() => setTab('order')}
          >
            주문기준
          </button>
          <button
            type="button"
            className={`${styles.tab} ${tab === 'bundle' ? styles.tabActive : ''}`}
            onClick={() => setTab('bundle')}
          >
            묶음주문기준
          </button>
        </div>
        <div className={styles.filterRow}>
          {activeStatus === 'shipped' ? (
            <select
              className={styles.select}
              value={shippedDateBasis}
              onChange={(e) =>
                setShippedDateBasis(e.target.value as 'order' | 'payment' | 'shipped')
              }
              aria-label="발송완료 기간 기준"
            >
              <option value="order">주문일자</option>
              <option value="payment">결제일자</option>
              <option value="shipped">발송완료 일자</option>
            </select>
          ) : (
            <label className={styles.filterLabel}>주문일자</label>
          )}
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              const v = e.target.value
              setDateFrom(v)
              setDateRangeByStatus((prev) => ({
                ...prev,
                [activeStatus]: { ...prev[activeStatus], from: v },
              }))
            }}
            className={styles.input}
          />
          <span className={styles.rangeSep}>~</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => {
              const v = e.target.value
              setDateTo(v)
              setDateRangeByStatus((prev) => ({
                ...prev,
                [activeStatus]: { ...prev[activeStatus], to: v },
              }))
            }}
            className={styles.input}
          />
          <div className={styles.quickDates}>
            <button type="button" className={styles.quickBtn} onClick={() => setQuickDate('today')}>오늘</button>
            <button type="button" className={styles.quickBtn} onClick={() => setQuickDate('1day')}>1일</button>
            <button type="button" className={styles.quickBtn} onClick={() => setQuickDate('1week')}>1주</button>
            <button type="button" className={styles.quickBtn} onClick={() => setQuickDate('1month')}>1개월</button>
          </div>
        </div>
        {activeStatus === 'preparing' && (
          <div className={styles.filterRow}>
            <label className={styles.filterLabel}>배송지역</label>
            <select
              className={styles.select}
              value={deliverySido}
              onChange={(e) => {
                const v = e.target.value
                setDeliverySido(v)
                setDeliveryGugun(PLACEHOLDER_GUGUN)
                setDeliveryEup(PLACEHOLDER_EUP)
              }}
            >
              {SIDO_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
            <select
              className={styles.select}
              value={deliveryGugun}
              onChange={(e) => {
                const v = e.target.value
                setDeliveryGugun(v)
                setDeliveryEup(PLACEHOLDER_EUP)
              }}
            >
              {gugunOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
            <select
              className={styles.select}
              value={deliveryEup}
              onChange={(e) => setDeliveryEup(e.target.value)}
            >
              {eupOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className={styles.filterBlock}>
          <div className={styles.filterTopRow}>
            <div className={styles.filterItem}>
              <label className={styles.filterLabel}>공급사</label>
              <select className={styles.select} value={supplier} onChange={(e) => setSupplier(e.target.value)}>
                {supplierOptions.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
            <div className={styles.filterItem}>
              <label className={styles.filterLabel}>예치금</label>
              <div className={styles.depositFilterGroup}>
                <select
                  className={styles.select}
                  value={depositScope}
                  onChange={(e) => setDepositScope(e.target.value as DepositScope)}
                >
                  <option value="전체">전체</option>
                  <option value="구매">구매</option>
                  <option value="제외">제외</option>
                </select>
                {depositScope === '구매' && (
                  <div className={styles.depositSegment} role="group" aria-label="예치금 포함 여부">
                    <button
                      type="button"
                      className={`${styles.depositSegmentBtn} ${depositIncludeMode === '포함' ? styles.depositSegmentBtnActive : ''}`}
                      onClick={() => setDepositIncludeMode('포함')}
                    >
                      예치금 포함
                    </button>
                    <button
                      type="button"
                      className={`${styles.depositSegmentBtn} ${depositIncludeMode === '미포함' ? styles.depositSegmentBtnActive : ''}`}
                      onClick={() => setDepositIncludeMode('미포함')}
                    >
                      예치금 미포함
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className={styles.filterItem}>
              <label className={styles.filterLabel}>플러스전용관</label>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={plusExclusiveY}
                  onChange={(e) => setPlusExclusiveY(e.target.checked)}
                />
                <span>Y</span>
              </label>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={!plusExclusiveY}
                  onChange={() => setPlusExclusiveY(false)}
                />
                <span>N</span>
              </label>
            </div>
          </div>
          <div className={styles.filterBottomRow}>
            <div className={styles.filterSearchRow}>
              <label className={styles.filterLabel}>검색어</label>
              <div className={styles.searchGroup}>
                <span className={styles.searchTypeLabel}>검색타입</span>
                <select className={styles.select} value={searchType2} onChange={(e) => setSearchType2(e.target.value)}>
                  {searchTypeOptions.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
                <input
                  type="text"
                  className={styles.input}
                  placeholder=""
                  value={searchKeyword2}
                  onChange={(e) => {
                    const v = e.target.value
                    if (v.length > 50) {
                      window.alert('검색어는 최대 50자까지 입력 가능합니다.')
                      setSearchKeyword2(v.slice(0, 50))
                      return
                    }
                    setSearchKeyword2(v)
                  }}
                />
              </div>
              {keywordRaw.length > 0 && keyword.trim().length === 0 && (
                <div className={styles.searchError}>검색어를 확인해주세요.</div>
              )}
              {activeStatus === 'all' && (
                <>
                  <label className={styles.filterLabel}>주문 상태</label>
                  <select
                    className={styles.select}
                    value={allStatusFilter}
                    onChange={(e) => setAllStatusFilter(e.target.value)}
                  >
                    {ALL_STATUS_FILTER_OPTIONS.map((opt) => (
                      <option key={opt.value || 'all'} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </>
              )}
            </div>
            <div className={styles.filterActions}>
              <button type="button" className={styles.btnSecondary} onClick={resetAllFilters}>검색 초기화</button>
              <button type="button" className={styles.btnPrimary}>검색하기</button>
            </div>
          </div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="주문금액" defaultOpen={false}>
        <div className={styles.summaryRow}>
          <span>주문금액 {summaryOrderAmount.toLocaleString()} 원</span>
          <span> - </span>
          <span>취소금액(부분취소 포함) {summaryCancelAmount.toLocaleString()} 원</span>
          <span> = </span>
          <span>최종결제금액 {summaryFinalAmount.toLocaleString()} 원</span>
        </div>
      </CollapsibleSection>

      <div className={styles.tableSection}>
        <div className={styles.tableHeader}>
          <h2 className={styles.tableTitle}>주문내역</h2>
          <div className={styles.tableActions}>
            <span className={styles.totalCount}>전체 {displayedOrders.length}건</span>
            <button
              type="button"
              className={styles.btnExcel}
              onClick={() => {
                const toExport =
                  displayedOrders.some((o) => selectedIds.has(o.id))
                    ? displayedOrders.filter((o) => selectedIds.has(o.id))
                    : displayedOrders
                downloadOrderExcel(toExport)
              }}
            >
              엑셀 다운로드
            </button>
            {activeStatus === 'payment_complete' && (
              <button type="button" className={styles.btnShipPrepare}>
                발송 준비중 처리
              </button>
            )}
            {activeStatus === 'preparing' && (
              <button type="button" className={styles.btnShipComplete}>
                발송완료 처리
              </button>
            )}
            {activeStatus === 'shipped' && (
              <button type="button" className={styles.btnShipPrepare}>
                발송 준비중 처리
              </button>
            )}
          </div>
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.colSticky1}>
                  <input
                    type="checkbox"
                    checked={allFilteredSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someFilteredSelected
                    }}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th className={styles.colSticky2}>주문번호</th>
                <th className={styles.colSticky3}>주문상태</th>
                <th>공급처</th>
                <th>상품명</th>
                <th>약국명</th>
                <th>고객명</th>
                <th>회원결제방식</th>
                <th>주문금액</th>
                <th>매출액</th>
                <th>공급가액</th>
                <th>부가세</th>
                <th>결제금액</th>
                <th>최종결제금액</th>
                <th>결제방식</th>
                <th>주문일시</th>
                <th>메모</th>
                <th>회원ID</th>
              </tr>
            </thead>
            <tbody>
              {orderTableLines.map((line, tableLineIdx) => {
                const row = line.baseRow
                const rs = line.rowspan
                const groupStart = line.lineIndex === 0 && tableLineIdx > 0
                return (
                  <tr
                    key={line.key}
                    className={groupStart ? styles.trOrderGroupStart : undefined}
                  >
                    {line.lineIndex === 0 && (
                      <td className={styles.colSticky1} rowSpan={rs}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(row.id)}
                          onChange={() => toggleSelectOne(row.id)}
                        />
                      </td>
                    )}
                    {line.lineIndex === 0 && (
                      <td className={styles.colSticky2} rowSpan={rs}>
                        <button
                          type="button"
                          className={styles.orderNoLink}
                          onClick={() => setDetailOpen(getOrderDetail(row))}
                        >
                          {row.orderNo}
                        </button>
                      </td>
                    )}
                    <td className={styles.colSticky3}>{line.supplierStatus}</td>
                    <td>{line.supplierDisplay}</td>
                    <td>{line.productSummary}</td>
                    {line.lineIndex === 0 && (
                      <td rowSpan={rs}>{row.pharmacyName}</td>
                    )}
                    {line.lineIndex === 0 && (
                      <td rowSpan={rs}>{row.customerName}</td>
                    )}
                    {line.lineIndex === 0 && (
                      <td rowSpan={rs}>{row.memberPaymentMethod}</td>
                    )}
                    <td>{line.supplierOrderAmount.toLocaleString()}</td>
                    <td>{line.supplierSalesAmount.toLocaleString()}</td>
                    <td>{line.supplierSupply.toLocaleString()}</td>
                    <td>{line.supplierTax.toLocaleString()}</td>
                    {line.lineIndex === 0 && (
                      <td rowSpan={rs}>{row.paymentAmount.toLocaleString()}</td>
                    )}
                    {line.lineIndex === 0 && (
                      <td rowSpan={rs}>{row.finalAmount.toLocaleString()}</td>
                    )}
                    {line.lineIndex === 0 && (
                      <td rowSpan={rs}>{row.paymentMethod}</td>
                    )}
                    {line.lineIndex === 0 && (
                      <td rowSpan={rs}>{row.orderDateTime}</td>
                    )}
                    {line.lineIndex === 0 && (
                      <td rowSpan={rs}>{row.memo}</td>
                    )}
                    {line.lineIndex === 0 && (
                      <td rowSpan={rs}>{row.memberId}</td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className={styles.pagination}>
            <button
              type="button"
              className={styles.pageBtn}
              disabled={safePage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            >
              이전
            </button>
            <span className={styles.pageInfo}>
              {totalPages > 0
                ? `${(safePage - 1) * PAGE_SIZE + 1}-${Math.min(safePage * PAGE_SIZE, displayedOrders.length)} / 전체 ${displayedOrders.length}건`
                : `0 / 전체 0건`}
            </span>
            <div className={styles.pageNumbers}>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`${styles.pageNum} ${p === safePage ? styles.pageNumActive : ''}`}
                  onClick={() => setCurrentPage(p)}
                >
                  {p}
                </button>
              ))}
            </div>
            <button
              type="button"
              className={styles.pageBtn}
              disabled={safePage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            >
              다음
            </button>
          </div>
        )}
      </div>

      <OrderDetailModal
        detail={detailOpen}
        onClose={() => setDetailOpen(null)}
        currentUserName="관리자1"
        onOrderCancel={(orderNo) => {
          setOrderStatusOverrides((prev) => ({ ...prev, [orderNo]: '주문 취소' }))
          setDetailOpen(null)
        }}
        onOrderCancelRequest={(orderNo) => {
          window.alert(`주문취소 요청이 접수되었습니다. (${orderNo})`)
        }}
      />
    </div>
  )
}
