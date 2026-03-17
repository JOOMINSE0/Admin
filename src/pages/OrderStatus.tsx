import { useState, useEffect } from 'react'
import * as XLSX from 'xlsx'
import CollapsibleSection from '../components/CollapsibleSection'
import OrderDetailModal, { type OrderDetailData } from '../components/OrderDetailModal'
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

const searchTypeOptions = ['약국명', '주문번호', '회원 아이디', '고객명', '상품명']

/** 발송준비중 배송지역 필터 (시도 → 구군 → 읍면동) */
const PLACEHOLDER_SIDO = '-시도-'
const PLACEHOLDER_GUGUN = '-구군-'
const PLACEHOLDER_EUP = '-읍면동-'
const REGION_TREE: Record<string, Record<string, string[]>> = {
  [PLACEHOLDER_SIDO]: { [PLACEHOLDER_GUGUN]: [PLACEHOLDER_EUP] },
  서울특별시: {
    [PLACEHOLDER_GUGUN]: [PLACEHOLDER_EUP],
    강남구: [PLACEHOLDER_EUP, '역삼동', '논현동', '대치동'],
    강북구: [PLACEHOLDER_EUP, '미아동', '수유동'],
    송파구: [PLACEHOLDER_EUP, '잠실동', '문정동'],
  },
  경기도: {
    [PLACEHOLDER_GUGUN]: [PLACEHOLDER_EUP],
    '수원시 영통구': [PLACEHOLDER_EUP, '영통동', '매탄동'],
    '성남시 분당구': [PLACEHOLDER_EUP, '정자동', '야탑동'],
    '고양시 덕양구': [PLACEHOLDER_EUP, '행신동', '화정동'],
  },
  부산광역시: {
    [PLACEHOLDER_GUGUN]: [PLACEHOLDER_EUP],
    해운대구: [PLACEHOLDER_EUP, '우동', '재송동'],
    부산진구: [PLACEHOLDER_EUP, '부전동', '연지동'],
  },
}
const SIDO_OPTIONS = [PLACEHOLDER_SIDO, ...Object.keys(REGION_TREE).filter((k) => k !== PLACEHOLDER_SIDO)]

type StatusKey = 'all' | 'order_complete' | 'payment_complete' | 'preparing' | 'shipped' | 'order_cancel'
const statusSteps: { key: StatusKey; label: string; icon: string; color: string }[] = [
  { key: 'all', label: '전체', icon: '', color: '#607d8b' },
  { key: 'order_complete', label: '주문 완료', icon: '', color: '#5c9ead' },
  { key: 'payment_complete', label: '결제완료', icon: '', color: '#4caf50' },
  { key: 'preparing', label: '발송 준비중', icon: '', color: '#ff9800' },
  { key: 'shipped', label: '발송 완료', icon: '', color: '#e91e63' },
  { key: 'order_cancel', label: '주문 취소 현황', icon: '', color: '#9e9e9e' },
]

// 상태 버튼 키 → 주문내역 orderStatus 문자열 매칭
const STATUS_KEY_TO_ORDER_STATUS: Record<Exclude<StatusKey, 'all'>, string> = {
  order_complete: '주문 완료',
  payment_complete: '결제완료',
  preparing: '발송 준비중',
  shipped: '발송 완료',
  order_cancel: '주문 취소',
}

/** 전체 현황에서만 사용: 주문 상태값 드롭다운 옵션 (value는 orderStatus 매칭용, ''=전체) */
const ALL_STATUS_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: '전체' },
  { value: '주문 완료', label: '주문 완료' },
  { value: '결제완료', label: '결제 완료' },
  { value: '발송 준비중', label: '발송 준비중' },
  { value: '발송 완료', label: '발송 완료' },
  { value: '주문 취소', label: '주문 취소' },
  { value: '부분 취소', label: '부분 취소' },
]

// 발송완료 하드코딩 주문 (상세 팝업에서 이미지 기준 데이터 표시)
const SHIPPED_ORDER_NO = 'P01041161391'

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
  },
  ...Array.from({ length: 10 }, (_, i) => {
    const statuses: string[] = ['주문 완료', '주문 완료', '주문 완료', '결제완료', '결제완료', '결제완료', '결제완료', '발송 준비중', '발송 준비중', '발송 준비중']
    const regions = [
      { deliverySido: '서울특별시' as const, deliveryGugun: '강남구', deliveryEup: '역삼동' },
      { deliverySido: '경기도' as const, deliveryGugun: '수원시 영통구', deliveryEup: '영통동' },
      { deliverySido: '부산광역시' as const, deliveryGugun: '해운대구', deliveryEup: '우동' },
    ]
    const r = regions[i % 3]
    const isPreparing = statuses[i] === '발송 준비중'
    return {
      id: i + 2,
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
      ...(isPreparing ? { deliverySido: r.deliverySido, deliveryGugun: r.deliveryGugun, deliveryEup: r.deliveryEup } : {}),
    }
  }),
]

function formatDate(d: Date) {
  return d.toISOString().slice(0, 10)
}

type OrderRow = (typeof mockOrders)[number]

function getOrderDetail(row: OrderRow): OrderDetailData {
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
    return {
      orderNo: 'P01041161391',
      sapOrderNo: sapLines.join('\n'),
      sapOrderNoBySupplier,
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

const EXCEL_HEADERS = [
  '번호', '주문번호', '공급처', '상품명', '약국명', '고객명', '회원결제방식',
  '주문금액', '매출액', '공급가액', '부가세', '결제금액', '최종결제금액',
  '결제방식', '주문일시', '주문상태', '메모', '회원ID',
]

function downloadOrderExcel(orders: OrderRow[]) {
  const rows = orders.map((row, idx) => [
    idx + 1,
    row.orderNo,
    row.supplier,
    row.productName,
    row.pharmacyName,
    row.customerName,
    row.memberPaymentMethod,
    row.orderAmount,
    row.salesAmount,
    row.supplyAmount,
    row.tax,
    row.paymentAmount,
    row.finalAmount,
    row.paymentMethod,
    row.orderDateTime,
    row.orderStatus,
    row.memo,
    row.memberId,
  ])
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

// 상태별 건수: 주문내역 orderStatus와 매칭해 실제 건수 사용
function getStatusCounts(orders: OrderRow[]): Record<StatusKey, number> {
  const counts: Record<StatusKey, number> = {
    all: orders.length,
    order_complete: 0,
    payment_complete: 0,
    preparing: 0,
    shipped: 0,
    order_cancel: 0,
  }
  orders.forEach((o) => {
    const key = (Object.entries(STATUS_KEY_TO_ORDER_STATUS).find(([, v]) => v === o.orderStatus)?.[0] as Exclude<StatusKey, 'all'>) ?? null
    if (key && key in counts) counts[key]++
  })
  return counts
}

export default function OrderStatus() {
  const [tab, setTab] = useState<'order' | 'bundle'>('order')
  const [dateFrom, setDateFrom] = useState('2026-03-06')
  const [dateTo, setDateTo] = useState('2026-03-13')
  const [activeStatus, setActiveStatus] = useState<StatusKey>('all')
  const [plusExclusiveY, setPlusExclusiveY] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [detailOpen, setDetailOpen] = useState<OrderDetailData | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  /** 주문번호별 상태 오버라이드 (주문 취소 버튼 등으로 변경된 상태) */
  const [orderStatusOverrides, setOrderStatusOverrides] = useState<Record<string, string>>({})

  const [supplier, setSupplier] = useState(supplierOptions[0])
  const [searchType2, setSearchType2] = useState('약국명')
  const [searchKeyword2, setSearchKeyword2] = useState('')
  const [deposit, setDeposit] = useState('전체')
  const [deliverySido, setDeliverySido] = useState(PLACEHOLDER_SIDO)
  const [deliveryGugun, setDeliveryGugun] = useState(PLACEHOLDER_GUGUN)
  const [deliveryEup, setDeliveryEup] = useState(PLACEHOLDER_EUP)
  /** 발송완료 현황: 기간 기준 (기본 주문일자) */
  const [shippedDateBasis, setShippedDateBasis] = useState<'order' | 'payment' | 'shipped'>('order')
  /** 전체 현황에서만: 주문 상태값 필터 ('')=전체 */
  const [allStatusFilter, setAllStatusFilter] = useState('')
  const initialDateFrom = '2026-03-06'
  const initialDateTo = '2026-03-13'

  const resetAllFilters = () => {
    setDateFrom(initialDateFrom)
    setDateTo(initialDateTo)
    setSupplier(supplierOptions[0])
    setSearchType2('약국명')
    setSearchKeyword2('')
    setDeposit('전체')
    setPlusExclusiveY(false)
    setDeliverySido(PLACEHOLDER_SIDO)
    setDeliveryGugun(PLACEHOLDER_GUGUN)
    setDeliveryEup(PLACEHOLDER_EUP)
    setShippedDateBasis('order')
    setAllStatusFilter('')
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
  if (activeStatus === 'shipped') {
    filteredOrders = filteredOrders.filter(shippedInRange)
  }

  const statusCounts = getStatusCounts(ordersWithOverrides)
  // 발송완료 탭 건수: 기간 필터 적용 후 건수로 표시 (기본 기간에 0건이면 0건으로 표시)
  const shippedCountInRange = ordersWithOverrides
    .filter((o) => o.orderStatus === STATUS_KEY_TO_ORDER_STATUS.shipped)
    .filter(shippedInRange).length
  const statusCountsForDisplay: Record<StatusKey, number> = {
    ...statusCounts,
    shipped: shippedCountInRange,
  }

  const PAGE_SIZE = 10
  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / PAGE_SIZE))
  const safePage = Math.min(currentPage, totalPages)
  const paginatedOrders = filteredOrders.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  useEffect(() => {
    setCurrentPage(1)
  }, [activeStatus, shippedDateBasis, dateFrom, dateTo, deliverySido, deliveryGugun, deliveryEup, allStatusFilter])

  useEffect(() => {
    if (currentPage > totalPages && totalPages >= 1) setCurrentPage(1)
  }, [currentPage, totalPages])

  const allFilteredSelected =
    filteredOrders.length > 0 && filteredOrders.every((o) => selectedIds.has(o.id))
  const someFilteredSelected =
    filteredOrders.some((o) => selectedIds.has(o.id)) && !allFilteredSelected

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredOrders.map((o) => o.id)))
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
    setDateFrom(formatDate(from))
    setDateTo(toStr)
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
            onChange={(e) => setDateFrom(e.target.value)}
            className={styles.input}
          />
          <span className={styles.rangeSep}>~</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
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
              <select className={styles.select} value={deposit} onChange={(e) => setDeposit(e.target.value)}>
                <option value="전체">전체</option>
                <option value="구매(즉시할인 포함)">구매(즉시할인 포함)</option>
                <option value="구매(즉시할인 제외)">구매(즉시할인 제외)</option>
                <option value="제외">제외</option>
              </select>
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
                <input type="text" className={styles.input} placeholder="" value={searchKeyword2} onChange={(e) => setSearchKeyword2(e.target.value)} />
              </div>
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

      <CollapsibleSection title="주문금액" defaultOpen={true}>
        <div className={styles.summaryRow}>
          <span>주문금액 3,430,912 원</span>
          <span>배송비 0 원</span>
          <span>결제금액 3,379,009 원</span>
          <span>카드 부분 취소 0 원</span>
          <span>최종결제금액 3,379,009 원</span>
        </div>
      </CollapsibleSection>

      <div className={styles.tableSection}>
        <div className={styles.tableHeader}>
          <h2 className={styles.tableTitle}>주문내역</h2>
          <div className={styles.tableActions}>
            <span className={styles.totalCount}>전체 {filteredOrders.length}건</span>
            <button
              type="button"
              className={styles.btnExcel}
              onClick={() => {
                const toExport =
                  filteredOrders.some((o) => selectedIds.has(o.id))
                    ? filteredOrders.filter((o) => selectedIds.has(o.id))
                    : filteredOrders
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
          </div>
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>
                <input
                  type="checkbox"
                  checked={allFilteredSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someFilteredSelected
                  }}
                  onChange={toggleSelectAll}
                />
              </th>
                <th>번호</th>
                <th>주문번호</th>
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
                <th>주문상태</th>
                <th>메모</th>
                <th>회원ID</th>
              </tr>
            </thead>
            <tbody>
              {paginatedOrders.map((row, idx) => (
                <tr key={row.id} className={idx === 0 ? styles.rowHighlight : ''}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(row.id)}
                      onChange={() => toggleSelectOne(row.id)}
                    />
                  </td>
                  <td>{(safePage - 1) * PAGE_SIZE + idx + 1}</td>
                  <td>
                    <button
                      type="button"
                      className={styles.orderNoLink}
                      onClick={() => setDetailOpen(getOrderDetail(row))}
                    >
                      {row.orderNo}
                    </button>
                  </td>
                  <td>{row.supplier}</td>
                  <td>{row.productName}</td>
                  <td>{row.pharmacyName}</td>
                  <td>{row.customerName}</td>
                  <td>{row.memberPaymentMethod}</td>
                  <td>{row.orderAmount.toLocaleString()}</td>
                  <td>{row.salesAmount.toLocaleString()}</td>
                  <td>{row.supplyAmount.toLocaleString()}</td>
                  <td>{row.tax.toLocaleString()}</td>
                  <td>{row.paymentAmount.toLocaleString()}</td>
                  <td>{row.finalAmount.toLocaleString()}</td>
                  <td>{row.paymentMethod}</td>
                  <td>{row.orderDateTime}</td>
                  <td>{row.orderStatus}</td>
                  <td>{row.memo}</td>
                  <td>{row.memberId}</td>
                </tr>
              ))}
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
                ? `${(safePage - 1) * PAGE_SIZE + 1}-${Math.min(safePage * PAGE_SIZE, filteredOrders.length)} / 전체 ${filteredOrders.length}건`
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
      />
    </div>
  )
}
