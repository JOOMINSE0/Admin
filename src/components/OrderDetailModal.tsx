import { useState, useEffect } from 'react'
import AccumHistoryModal from './AccumHistoryModal'
import styles from './OrderDetailModal.module.css'

/** 이 제약사들에 한해 SAP주문번호 컬럼을 제약사별 서브컬럼으로 표시 (데이터에 없으면 비움) */
const SAP_TARGET_SUPPLIER_NAMES = ['대웅제약', '대웅바이오', '한올바이오파마'] as const

/** 공급사명에서 괄호·접미사 제거 후 비교용 이름 반환 (예: "대웅제약 (도매)" → "대웅제약") */
export function normalizeSupplierForSap(name: string): string {
  return name.replace(/\s*\([^)]*\)\s*$/, '').trim()
}

/** SAP 문자열에서 오더/납품/빌링 번호 추출 (예: "오더(123) / 납품(456) / 빌링(789)" → { order, delivery, billing }) */
function parseSapOrderNo(raw: string): { order: string; delivery: string; billing: string } {
  const orderMatch = raw.match(/오더\s*\(([^)]+)\)/)
  const deliveryMatch = raw.match(/납품\s*\(([^)]+)\)/)
  const billingMatch = raw.match(/빌링\s*\(([^)]+)\)/)
  return {
    order: orderMatch ? orderMatch[1].trim() : '-',
    delivery: deliveryMatch ? deliveryMatch[1].trim() : '-',
    billing: billingMatch ? billingMatch[1].trim() : '-',
  }
}

/** SAP 문자열(전체 또는 공급사별)에 납품번호가 하나라도 있으면 true (-·빈값·미기재 제외) */
export function sapHasAnyDeliveryNumber(detail: {
  sapOrderNo?: string
  sapOrderNoBySupplier?: Record<string, string>
}): boolean {
  const lineHasDelivery = (line: string): boolean => {
    const { delivery } = parseSapOrderNo(line)
    return delivery !== '-' && delivery.length > 0
  }
  const rawHasDelivery = (raw: string): boolean => {
    if (!raw?.trim()) return false
    return raw
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .some(lineHasDelivery)
  }
  if (detail.sapOrderNoBySupplier) {
    for (const v of Object.values(detail.sapOrderNoBySupplier)) {
      if (v && rawHasDelivery(v)) return true
    }
  }
  if (detail.sapOrderNo && rawHasDelivery(detail.sapOrderNo)) return true
  return false
}

/** SAP 라인 마지막 괄호 텍스트 추출 (예: "...(출하완료)" → "출하완료") */
function parseSapLastParenText(line: string): string | null {
  const m = line.match(/\(([^()]+)\)\s*$/)
  return m ? m[1].trim() : null
}

/**
 * SAP 라인 끝에서 (공장)/(지역)을 찾음. 끝에 (출하완료) 등이 여러 겹이면 벗겨 가며 탐색.
 * `...빌링(xxx) (지역)`처럼 공백 뒤 접미어도 확실히 인식.
 */
function parseTrailingFactoryRegionFromSapLine(line: string): '공장' | '지역' | null {
  const explicit = line.trim().match(/\((공장|지역)\)\s*$/)
  if (explicit) return explicit[1] as '공장' | '지역'

  let s = line.trimEnd()
  while (s.length > 0) {
    const m = s.match(/\(([^()]*)\)\s*$/)
    if (!m || m.index === undefined) break
    const inner = m[1].trim()
    if (inner === '공장' || inner === '지역') return inner
    s = s.slice(0, m.index).trimEnd()
  }
  return null
}

/** 라인 끝 (공장)/(지역), 없으면 공급사 기본 출하구분 */
function shipmentTypeFromSapLine(
  line: string,
  supplierFallback?: '공장' | '지역'
): '공장' | '지역' | null {
  const fromLine = parseTrailingFactoryRegionFromSapLine(line)
  if (fromLine) return fromLine
  if (supplierFallback === '공장' || supplierFallback === '지역') return supplierFallback
  return null
}

/** SAP 라인 마지막 괄호 텍스트를 주문상태로 대략 매핑 */
function mapSapLastParenToOrderStatus(raw: string): string | null {
  // 출하 단계는 앱의 발송 단계로 매핑
  if (/출하\s*완료/.test(raw) || /출하완료/.test(raw)) return '발송 완료'
  if (/일부\s*완료/.test(raw) || /일부완료/.test(raw)) return '발송 준비중'
  if (/출하/.test(raw) && !/완료/.test(raw)) return '발송 준비중'
  if (/준비/.test(raw) && /출하/.test(raw)) return '발송 준비중'

  // 취소/부분취소 등의 키워드(데이터 포맷이 바뀌어도 최소한의 표시 유지 목적)
  if (/부분/.test(raw) && /취소/.test(raw)) return '부분 취소'
  if (/취소/.test(raw)) return '주문 취소'

  if (/결제\s*완료/.test(raw) || /결제완료/.test(raw)) return '결제완료'
  if (/주문\s*완료/.test(raw) || /주문완료/.test(raw) || /오더\s*완료/.test(raw) || /오더완료/.test(raw)) {
    return '주문 완료'
  }

  return null
}

export function getSupplierOrderStatusFromSap(args: {
  sapOrderNoBySupplier?: Record<string, string>
  supplierName: string
  fallbackOrderStatus: string
}): string {
  const { sapOrderNoBySupplier, supplierName, fallbackOrderStatus } = args
  if (!sapOrderNoBySupplier) return fallbackOrderStatus

  const supplierKey = normalizeSupplierForSap(supplierName)
  const raw = sapOrderNoBySupplier[supplierKey]
  if (!raw || !raw.trim()) return fallbackOrderStatus

  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const mapped = lines
    .map((line) => {
      const last = parseSapLastParenText(line)
      if (!last) return null
      return mapSapLastParenToOrderStatus(last)
    })
    .filter((v): v is string => !!v)

  if (mapped.length === 0) return fallbackOrderStatus

  // 완료가 있으면 완료 우선, 그 외에는 준비중/그 다음 순
  if (mapped.includes('발송 완료')) return '발송 완료'
  if (mapped.includes('발송 준비중')) return '발송 준비중'
  if (mapped.includes('부분 취소')) return '부분 취소'
  if (mapped.includes('주문 취소')) return '주문 취소'
  if (mapped.includes('결제완료')) return '결제완료'
  if (mapped.includes('주문 완료')) return '주문 완료'

  return mapped[0] ?? fallbackOrderStatus
}

/** "12,345원" / "0원" 등에서 숫자만 추출 */
function parseWonToNumber(s: string | undefined): number {
  if (s == null || !String(s).trim()) return 0
  const n = parseInt(String(s).replace(/[원,\s]/g, ''), 10)
  return Number.isNaN(n) ? 0 : n
}

/** SAP 라인 앞부분에서 OTC/ETC 추출 (예: "OTC(제): ..." → "OTC", "ETC(바): ..." → "ETC") */
function parseSapCategoryFromLine(line: string): 'OTC' | 'ETC' | null {
  const m = line.trim().match(/^(OTC|ETC)/i)
  return m ? (m[1].toUpperCase() as 'OTC' | 'ETC') : null
}

/** 상품 텍스트(상품명/규격 등)에서 [제약 공장 출하(택배)] / [지역 창고 출하(도매 위탁)] 파싱해 출하구분 반환 */
function getShipmentTypeFromProductText(productSpec: string | undefined): '제약공장 출하' | '지역공장 출하' | '' {
  if (!productSpec || !productSpec.trim()) return ''
  const s = productSpec.trim()
  if (/\[제약\s*공장\s*출하/.test(s)) return '제약공장 출하'
  if (/\[지역\s*창고\s*출하/.test(s) || /\[지역\s*공장\s*출하/.test(s)) return '지역공장 출하'
  return ''
}

export type OrderDetailData = {
  orderNo: string
  sapOrderNo: string
  /** 제약사별 SAP주문번호 (키: 공급사명, 값: 해당 SAP번호) */
  sapOrderNoBySupplier?: Record<string, string>
  /** SAP 공급사별 출하구분 배지 (지역/공장) */
  sapShipmentTypeBySupplier?: Record<string, '지역' | '공장'>
  /** SAP 공급사별 구분 (OTC/ETC). 오른쪽에 표시 */
  sapCategoryBySupplier?: Record<string, 'OTC' | 'ETC'>
  orderDateTime: string
  orderStatus: string
  orderStatusDate: string
  totalOrderAmount: number
  orderIdEmail: string
  paymentMethod: string
  products: {
    supplierName: string
    expectedDeliveryDate: string
    category: string
    productSpec: string
    manufacturer: string
    sellingPrice: string
    orderQty: string
    subtotal: string
    shippingCost: string
    /** 출하구분: 제약공장 출하(공장) / 지역공장 출하(창고). 정렬 시 공장 우선 */
    shipmentType?: '제약공장 출하' | '지역공장 출하'
    /** 다공급사 테이블의 출하 구분 열: 병합 시 이후 행은 'omit' */
    shipmentCell?: { badge: '공장' | '지역'; rowSpan?: number } | 'omit'
  }[]
  supplierSummary: {
    supplier: string
    totalAmount: string
    shippingCost: string
    otcDiscount: string
    costDiscount: string
    mileageUsed: string
  }[]
  paymentSummary: {
    minusBalance: string
    supplierCoupon: string
    paymentAmount: string
    earnedMileage: string
    expectedDeposit: string
  }[]
  customer: {
    recipient: string
    contact: string
    businessNo: string
    medicalCode: string
    address: string
  }
  vendorMessage: string
  adminMemos?: { id: string; authorName: string; content: string }[]
  /** 토글 우측 배송 예정일: 공장·지역별 시각 문구 (키: 공급사명). 없으면 상품 첫 행 expectedDeliveryDate 한 줄 */
  supplierDeliverySlots?: Record<
    string,
    { factory?: string; region?: string; /** 배지 없이 문구만 (한 줄) */ simple?: string }
  >
}

type OrderDetailProduct = OrderDetailData['products'][number]
type ShipmentColResolved = { badge: '공장' | '지역'; rowSpan?: number } | 'omit' | null

/** 출하 구분 열: 명시 shipmentCell 또는 shipmentType·상품명·SAP 공급사 기본값 */
function resolveShipmentColumnCell(
  p: OrderDetailProduct,
  detail: OrderDetailData,
  supplierBlockName: string
): ShipmentColResolved {
  if (p.shipmentCell === 'omit') return 'omit'
  if (p.shipmentCell && typeof p.shipmentCell === 'object') return p.shipmentCell

  const resolvedType = p.shipmentType ?? getShipmentTypeFromProductText(p.productSpec)
  if (resolvedType === '제약공장 출하') return { badge: '공장' }
  if (resolvedType === '지역공장 출하') return { badge: '지역' }

  const sap = detail.sapShipmentTypeBySupplier?.[normalizeSupplierForSap(supplierBlockName)]
  if (sap === '공장' || sap === '지역') return { badge: sap }

  return null
}

/**
 * 출하 구분 정렬: 공장(0) → 지역(1) → 미구분(2).
 * shipmentCell·omit·SAP까지 반영해 shipmentType만 없는 데이터도 공장 우선.
 */
function getShipmentSortPriority(
  p: OrderDetailProduct,
  detail: OrderDetailData,
  supplierBlockName: string
): number {
  const fromTypeOrText =
    p.shipmentType ?? getShipmentTypeFromProductText(p.productSpec)
  if (fromTypeOrText === '제약공장 출하') return 0
  if (fromTypeOrText === '지역공장 출하') return 1

  if (p.shipmentCell === 'omit') {
    // 병합 행: 위에서 타입을 못 찾은 경우 지역 그룹으로 간주(대웅제약 2~6행 등)
    return 1
  }

  if (p.shipmentCell && typeof p.shipmentCell === 'object') {
    return p.shipmentCell.badge === '공장' ? 0 : 1
  }

  const sap = detail.sapShipmentTypeBySupplier?.[normalizeSupplierForSap(supplierBlockName)]
  if (sap === '공장') return 0
  if (sap === '지역') return 1

  return 2
}

type OrderDetailModalProps = {
  detail: OrderDetailData | null
  onClose: () => void
  currentUserName?: string
  /** 주문 취소 버튼 클릭 시 호출 (주문번호 전달). 호출 후 목록/탭 반영을 위해 모달을 닫음 */
  onOrderCancel?: (orderNo: string) => void
  /** SAP에 납품번호가 있을 때 노출되는 주문취소요청 버튼 콜백 */
  onOrderCancelRequest?: (orderNo: string) => void
}

type PartialCancelRecord = {
  id: string
  supplierName: string
  productSpec: string
  manufacturer: string
  sellingPrice: string
  orderQty: string
  cancelReturnQty: string
  depositAccum: string
  mileageAccum: string
  cardCancelAmount: string
}

type PartialCancelRowInput = { accumType: string; reason: string; cancelQty: string }

const ACCUM_TYPE_OPTIONS = ['선택', '부분취소', '판매가조정', '낱알반품', '배송비'] as const
const PARTIAL_CANCEL_REASON_OPTIONS = ['선택', '재고부족', '고객요청'] as const

export default function OrderDetailModal({
  detail,
  onClose,
  currentUserName = '관리자1',
  onOrderCancel,
  onOrderCancelRequest,
}: OrderDetailModalProps) {
  const [openSuppliers, setOpenSuppliers] = useState<Set<string>>(new Set())
  const [memos, setMemos] = useState<{ id: string; authorName: string; content: string }[]>([])
  const [editingMemoId, setEditingMemoId] = useState<string | null>(null)
  const [editingContent, setEditingContent] = useState('')
  const [newMemoContent, setNewMemoContent] = useState('')
  const [showPartialCancelForm, setShowPartialCancelForm] = useState(false)
  const [partialCancelRecords, setPartialCancelRecords] = useState<PartialCancelRecord[]>([])
  const [partialCancelInputs, setPartialCancelInputs] = useState<Record<number, PartialCancelRowInput>>({})
  /** 부분취소 폼에서 선택된 상품 행 인덱스 */
  const [partialCancelSelectedIds, setPartialCancelSelectedIds] = useState<Set<number>>(() => new Set())
  const [partialCancelConfirmOpen, setPartialCancelConfirmOpen] = useState(false)
  const [partialCancelPendingRecords, setPartialCancelPendingRecords] = useState<PartialCancelRecord[]>([])
  const [showAccumHistoryModal, setShowAccumHistoryModal] = useState(false)

  useEffect(() => {
    setMemos(detail?.adminMemos ?? [])
    setEditingMemoId(null)
    setNewMemoContent('')
    setOpenSuppliers(new Set())
    setShowPartialCancelForm(false)
    setPartialCancelRecords([])
    setPartialCancelInputs({})
    setPartialCancelSelectedIds(new Set())
    setPartialCancelConfirmOpen(false)
    setPartialCancelPendingRecords([])
    setShowAccumHistoryModal(false)
  }, [detail?.orderNo, detail?.adminMemos, detail?.products])

  const toggleSupplier = (name: string) => {
    setOpenSuppliers((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  const handleDeleteMemo = (id: string) => {
    setMemos((prev) => prev.filter((m) => m.id !== id))
    if (editingMemoId === id) setEditingMemoId(null)
  }

  const handleEditStart = (id: string, content: string) => {
    setEditingMemoId(id)
    setEditingContent(content)
  }

  const handleEditSave = () => {
    if (!editingMemoId) return
    setMemos((prev) =>
      prev.map((m) => (m.id === editingMemoId ? { ...m, content: editingContent } : m))
    )
    setEditingMemoId(null)
    setEditingContent('')
  }

  const handleEditCancel = () => {
    setEditingMemoId(null)
    setEditingContent('')
  }

  const handleAddMemo = () => {
    const content = newMemoContent.trim()
    if (!content) return
    setMemos((prev) => [
      ...prev,
      { id: String(Date.now()), authorName: currentUserName, content },
    ])
    setNewMemoContent('')
  }

  const openPartialCancelForm = () => {
    setPartialCancelInputs({})
    if (detail?.products?.length) {
      setPartialCancelSelectedIds(new Set(detail.products.map((_, i) => i)))
    } else {
      setPartialCancelSelectedIds(new Set())
    }
    setShowPartialCancelForm(true)
  }

  const closePartialCancelForm = () => {
    setShowPartialCancelForm(false)
    setPartialCancelInputs({})
    setPartialCancelSelectedIds(new Set())
    setPartialCancelConfirmOpen(false)
    setPartialCancelPendingRecords([])
  }

  const togglePartialCancelRow = (index: number) => {
    setPartialCancelSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  const togglePartialCancelSelectAll = () => {
    if (!detail?.products?.length) return
    const n = detail.products.length
    setPartialCancelSelectedIds((prev) => {
      if (prev.size === n) return new Set()
      return new Set(detail.products.map((_, i) => i))
    })
  }

  const setPartialCancelInput = (index: number, field: keyof PartialCancelRowInput, value: string) => {
    setPartialCancelInputs((prev) => ({
      ...prev,
      [index]: {
        accumType: prev[index]?.accumType ?? '선택',
        reason: prev[index]?.reason ?? '',
        cancelQty: prev[index]?.cancelQty ?? '',
        [field]: value,
      },
    }))
  }

  const parsePrice = (s: string): number => {
    const n = parseInt(String(s).replace(/[,\s원]/g, ''), 10)
    return Number.isNaN(n) ? 0 : n
  }

  /** 주문 수량 문자열에서 최대 수량(숫자) 추출 */
  const parseOrderQtyMax = (q: string | undefined): number => {
    if (!q) return 0
    const m = String(q).match(/\d+/)
    if (!m) return 0
    const n = parseInt(m[0], 10)
    return Number.isNaN(n) ? 0 : n
  }

  /** 저장 클릭 → 유효성 검사 후 확인 모달 */
  const requestPartialCancelSave = () => {
    if (!detail) return
    const newRecords: PartialCancelRecord[] = []
    const errors: string[] = []

    detail.products.forEach((p, index) => {
      if (!partialCancelSelectedIds.has(index)) return
      const row = partialCancelInputs[index]
      if (!row) return
      const cancelQtyStr = row.cancelQty.trim()
      const reason = row.reason.trim()
      if (!cancelQtyStr && (!reason || reason === '선택')) return

      const cancelNum = parseInt(cancelQtyStr, 10)
      if (Number.isNaN(cancelNum) || cancelNum < 1) {
        errors.push(`「${p.productSpec ?? '상품'}」: 취소 수량은 1 이상의 숫자로 입력해 주세요.`)
        return
      }

      const maxQty = parseOrderQtyMax(p.orderQty)
      if (maxQty > 0 && cancelNum > maxQty) {
        errors.push(
          `「${p.productSpec ?? '상품'}」: 취소 수량은 기존 주문 수량(${p.orderQty})을 넘을 수 없습니다.`
        )
        return
      }

      const unitPrice = parsePrice(p.sellingPrice)
      const accumNum = unitPrice * cancelNum
      newRecords.push({
        id: `pc-${detail.orderNo}-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 9)}`,
        supplierName: p.supplierName,
        productSpec: p.productSpec,
        manufacturer: p.manufacturer,
        sellingPrice: p.sellingPrice,
        orderQty: p.orderQty,
        cancelReturnQty: `${cancelNum} 개`,
        depositAccum: `${accumNum.toLocaleString()} 원`,
        mileageAccum: '0 원',
        cardCancelAmount: '0 원',
      })
    })

    if (errors.length > 0) {
      window.alert(errors.join('\n'))
      return
    }
    if (newRecords.length === 0) {
      window.alert('선택한 상품 중 부분취소할 항목에 취소 수량을 입력해 주세요.')
      return
    }

    setPartialCancelPendingRecords(newRecords)
    setPartialCancelConfirmOpen(true)
  }

  /** 확인 모달에서 확정 시에만 부분취소 내역 반영 */
  const confirmPartialCancelSave = () => {
    const toAdd = partialCancelPendingRecords
    if (toAdd.length === 0) {
      setPartialCancelConfirmOpen(false)
      return
    }
    setPartialCancelPendingRecords([])
    setPartialCancelConfirmOpen(false)
    setPartialCancelRecords((prev) => [...prev, ...toAdd])
    closePartialCancelForm()
  }

  if (!detail) return null

  const status = detail.orderStatus
  const supplierNames = Array.from(new Set(detail.products.map((p) => p.supplierName).filter(Boolean)))
  const hasMultipleSuppliers = supplierNames.length > 1
  /** 공급사별로 파생 주문상태가 서로 다를 때만 요약 행에 `공급사별 상태 상이` 표시 */
  const statusDiffersAcrossSuppliers =
    supplierNames.length > 1 &&
    new Set(
      supplierNames.map((name) =>
        getSupplierOrderStatusFromSap({
          sapOrderNoBySupplier: detail.sapOrderNoBySupplier,
          supplierName: name,
          fallbackOrderStatus: detail.orderStatus,
        })
      )
    ).size > 1
  const statusActionButton =
    status === '결제완료' ? { label: '발송 준비중 처리', className: styles.btnShip } :
    status === '발송 준비중' ? { label: '발송완료 처리', className: styles.btnShip } :
    status === '발송 완료' ? { label: '발송 준비중 처리', className: styles.btnShip } :
    null

  /** 대웅그룹 공급사만 있을 때(세 곳 중 하나만 또는 여러 곳만) 부분취소 비노출. 타 공급사와 섞이면 노출 */
  const sapNames = SAP_TARGET_SUPPLIER_NAMES as readonly string[]
  const hasDaewongGroupProduct = detail.products.some((p) =>
    sapNames.includes(normalizeSupplierForSap(p.supplierName))
  )
  const hasNonDaewongGroupProduct = detail.products.some(
    (p) => !sapNames.includes(normalizeSupplierForSap(p.supplierName))
  )
  const hidePartialCancelDaewongGroupOnly = hasDaewongGroupProduct && !hasNonDaewongGroupProduct

  const showOrderCancelRequestButton = sapHasAnyDeliveryNumber(detail)

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>
            상세주문정보
          </h2>
          <div className={styles.actions}>
            <button type="button" className={styles.btnPrint}>프린트하기</button>
            {(status === '주문 완료' || status === '결제완료') && !hidePartialCancelDaewongGroupOnly && (
              <button type="button" className={styles.btnPartialCancel} onClick={openPartialCancelForm}>부분취소</button>
            )}
            {(status === '주문 완료' || status === '결제완료') && !showOrderCancelRequestButton && (
              <button
                type="button"
                className={styles.btnOrderCancel}
                onClick={() => {
                  if (detail?.orderNo && onOrderCancel) {
                    onOrderCancel(detail.orderNo)
                    window.alert('주문 취소가 완료되었습니다.')
                    onClose()
                  }
                }}
              >
                주문 취소
              </button>
            )}
            {showOrderCancelRequestButton && (
              <button
                type="button"
                className={styles.btnOrderCancelRequest}
                onClick={() => {
                  if (!detail.orderNo) return
                  if (onOrderCancelRequest) {
                    onOrderCancelRequest(detail.orderNo)
                  } else {
                    window.alert('주문취소 요청이 접수되었습니다.')
                  }
                }}
              >
                주문취소요청
              </button>
            )}
            {statusActionButton && (
              <button type="button" className={statusActionButton.className}>
                {statusActionButton.label}
              </button>
            )}
            <button type="button" className={styles.btnClose} onClick={onClose} aria-label="닫기">×</button>
          </div>
        </div>

        <div className={styles.body}>
          {showPartialCancelForm && (
            <div className={styles.partialCancelForm}>
              <div className={styles.partialCancelGuidance}>
                <ul>
                  <li>* [부분취소]는 발송완료전인 상품에 대해서 예치금을 지급할 수 있습니다.</li>
                  <li>* 해당상품의 적립구분, 부분취소사유, 취소 수량을 입력하고 저장 버튼을 눌러주세요.</li>
                  <li>* [낱알반품][판매가조정]은 발송완료후의 상품에 대해서 예치금을 지급할 수 있습니다.</li>
                  <li>* 단, 적립금액은 취소가능수량 * 주문단가를 초과할 수 없습니다.</li>
                  <li>* [낱알반품]을 했을 경우, 해당 상품은 반품이 불가능하며, 반품이 안된 상품에 한해서 낱알반품을 받을 수 있습니다.</li>
                  <li>* [판매가조정]은 반품, 낱알반품이 발생하지 않은 경우에만 판매가조정이 가능합니다.</li>
                  <li>* 배송비에 대한 적립은 배송비가 발생한 주문에 대해서 가능합니다.</li>
                </ul>
              </div>
              <div className={styles.tableWrap}>
                <table className={styles.partialCancelTable}>
                  <thead>
                    <tr>
                      <th className={styles.partialCancelThSelect}>
                        <input
                          type="checkbox"
                          aria-label="부분취소 행 전체 선택"
                          checked={
                            (detail.products.length > 0 &&
                              partialCancelSelectedIds.size === detail.products.length) ||
                            false
                          }
                          ref={(el) => {
                            if (el) {
                              const n = detail.products.length
                              const s = partialCancelSelectedIds.size
                              el.indeterminate = n > 0 && s > 0 && s < n
                            }
                          }}
                          onChange={togglePartialCancelSelectAll}
                        />
                      </th>
                      <th>주문번호</th>
                      <th>공급처</th>
                      <th>자체상품번호</th>
                      <th>상품명</th>
                      <th>주문단가</th>
                      <th>주문</th>
                      <th>가능</th>
                      <th>적립구분</th>
                      <th>부분취소사유</th>
                      <th>취소</th>
                      <th>적립금액</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.products.map((p, index) => (
                      <tr key={`pc-row-${index}`}>
                        <td className={styles.partialCancelTdSelect}>
                          <input
                            type="checkbox"
                            aria-label={`${p.productSpec ?? '상품'} 선택`}
                            checked={partialCancelSelectedIds.has(index)}
                            onChange={() => togglePartialCancelRow(index)}
                          />
                        </td>
                        <td>{detail.orderNo}</td>
                        <td>{p.supplierName}</td>
                        <td>{1003432349 + index}</td>
                        <td>{p.productSpec}</td>
                        <td>{p.sellingPrice}</td>
                        <td>{p.orderQty}</td>
                        <td>{p.orderQty ?? '-'}</td>
                        <td>
                          <select
                            className={styles.partialCancelSelect}
                            value={partialCancelInputs[index]?.accumType ?? '선택'}
                            onChange={(e) => setPartialCancelInput(index, 'accumType', e.target.value)}
                          >
                            {ACCUM_TYPE_OPTIONS.map((opt) => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <select
                            className={styles.partialCancelSelect}
                            value={partialCancelInputs[index]?.reason ?? '선택'}
                            onChange={(e) => setPartialCancelInput(index, 'reason', e.target.value)}
                          >
                            {PARTIAL_CANCEL_REASON_OPTIONS.map((opt) => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input
                            type="text"
                            className={styles.partialCancelInput}
                            value={partialCancelInputs[index]?.cancelQty ?? ''}
                            onChange={(e) => setPartialCancelInput(index, 'cancelQty', e.target.value)}
                            placeholder="0"
                          />
                        </td>
                        <td className={styles.partialCancelAccumCell}>
                          {(parsePrice(p.sellingPrice) * (parseInt(partialCancelInputs[index]?.cancelQty || '0', 10) || 0)).toLocaleString()}원
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className={styles.partialCancelActions}>
                <button type="button" className={styles.btnPartialCancelSubmit} onClick={requestPartialCancelSave}>저장</button>
                <button type="button" className={styles.btnPartialCancelCancel} onClick={closePartialCancelForm}>취소</button>
              </div>
            </div>
          )}

          <div className={styles.contentSection}>
            <div className={styles.sectionTitleBar}>
              <span className={styles.sectionTitle}>상세주문정보</span>
            </div>
            <div className={styles.sectionBody}>
            <table className={styles.summaryTable}>
              <tbody>
                <tr>
                  <th>주문 번호</th>
                  <td className={styles.orderNoLink}>{detail.orderNo}</td>
                  <th>총 주문금액</th>
                  <td>{detail.totalOrderAmount.toLocaleString()}</td>
                </tr>
                <tr>
                  <th>주문일시</th>
                  <td>{detail.orderDateTime}</td>
                  <th>주문아이디/이메일</th>
                  <td>{detail.orderIdEmail}</td>
                </tr>
                <tr>
                  <th>주문상태</th>
                  <td>
                    {statusDiffersAcrossSuppliers
                      ? '공급사별 상태 상이'
                      : `${detail.orderStatus} (${detail.orderStatusDate})`}
                  </td>
                  <th>결제방식</th>
                  <td>{detail.paymentMethod}</td>
                </tr>
              </tbody>
            </table>

            {(() => {
              const totalCostDiscount = (detail.supplierSummary ?? []).reduce((sum, s) => {
                const v = parseInt(String(s.costDiscount || '0').replace(/[원,\s]/g, ''), 10)
                return sum + (Number.isNaN(v) ? 0 : v)
              }, 0)
              const orderAmount = detail.totalOrderAmount
              const payRow = detail.paymentSummary?.[0]
              const parsedPayment = parseWonToNumber(payRow?.paymentAmount)
              const computedFinal = Math.max(0, orderAmount - totalCostDiscount)
              /** 결제요약의 실결제액: paymentAmount 우선, 없으면 주문금액-비용할인 */
              const resolvedFinal =
                parsedPayment > 0 ? parsedPayment : computedFinal
              /** PO1041161391 모의건: 총 결제·예치금 표기 0원 (할인금액 등은 그대로) */
              const isPo1041161391 = detail.orderNo === 'PO1041161391'
              const finalPayment = isPo1041161391 ? 0 : resolvedFinal
              const displayDeposit = isPo1041161391 ? 0 : resolvedFinal
              /** 예치금/쿠폰 등 비용할인 외 표기 할인 (paymentSummary 기준) */
              const bundleDiscountAmt =
                parseWonToNumber(payRow?.minusBalance) + parseWonToNumber(payRow?.supplierCoupon)
              return (
                <div className={styles.paymentCallout}>
                  {`총 결제금액 ${finalPayment.toLocaleString()}원 (할인금액 ${bundleDiscountAmt.toLocaleString()}원) (주문금액:${orderAmount.toLocaleString()}원 - 비용할인:${totalCostDiscount.toLocaleString()}원 - 예치금:${displayDeposit.toLocaleString()}원)`}
                </div>
              )
            })()}

            {(() => {
              const sapSuppliers = SAP_TARGET_SUPPLIER_NAMES.filter((sapName) =>
                detail.products.some(
                  (p) => normalizeSupplierForSap(p.supplierName) === sapName
                )
              )
              const bySupplier = detail.sapOrderNoBySupplier
              const singleFallback = sapSuppliers.length === 1 ? detail.sapOrderNo : undefined
              const hasSap = sapSuppliers.length > 0
              if (!hasSap) return null
              return (
                <div className={styles.sapOrderSection}>
                  <div className={styles.sectionTitleBar}>
                    <span className={styles.sectionTitle}>SAP 주문 정보</span>
                  </div>
                  <div className={styles.sectionBody}>
                    <table className={`${styles.sapOrderNoInnerTable} ${styles.sapOrderNoEqualCols}`}>
                      <colgroup>
                        {sapSuppliers.map((_, i) => (
                          <col key={i} style={{ width: `${100 / sapSuppliers.length}%` }} />
                        ))}
                      </colgroup>
                      <thead>
                        <tr>
                          {sapSuppliers.map((name) => (
                            <th key={name} className={styles.sapOrderNoThCompany}>
                              <div>{name}</div>
                            </th>
                          ))}
                        </tr>
                        <tr>
                          {sapSuppliers.map((name) => (
                            <th key={`${name}-fields`} className={styles.sapOrderNoThFieldLabels}>
                              오더번호 / 납품번호 / 빌링번호
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          {sapSuppliers.map((name) => {
                            const raw = bySupplier?.[name] ?? singleFallback ?? ''
                            if (!raw || !raw.trim()) return <td key={name} className={styles.sapOrderNoTd}>-</td>
                            const supplierShipmentFallback = detail.sapShipmentTypeBySupplier?.[name]
                            const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
                            return (
                              <td key={name} className={styles.sapOrderNoTd}>
                                {lines.map((line, i) => {
                                  const parsed = parseSapOrderNo(line)
                                  const hasData = parsed.order !== '-' || parsed.delivery !== '-' || parsed.billing !== '-'
                                  const category =
                                    parseSapCategoryFromLine(line) ?? detail.sapCategoryBySupplier?.[name] ?? null
                                  const shipmentBadge = shipmentTypeFromSapLine(line, supplierShipmentFallback)
                                  return hasData ? (
                                    <div key={i} className={styles.sapOrderBlock}>
                                      <div className={styles.sapOrderBlockNumbers}>
                                        {parsed.order} / {parsed.delivery} / {parsed.billing}
                                      </div>
                                      {(category != null || shipmentBadge != null) && (
                                        <div className={styles.sapOrderBlockOtcRow}>
                                          {category != null && (
                                            <span className={styles.sapOrderNoCategory}>{category}</span>
                                          )}
                                          {category != null && shipmentBadge != null && (
                                            <span className={styles.sapOrderNoCellSep} aria-hidden>
                                              |
                                            </span>
                                          )}
                                          {shipmentBadge != null && (
                                            <span
                                              className={
                                                shipmentBadge === '지역'
                                                  ? styles.shipmentPillRegion
                                                  : styles.shipmentPillFactory
                                              }
                                            >
                                              {shipmentBadge}
                                            </span>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <div key={i} className={styles.sapOrderNoLine}>{line}</div>
                                  )
                                })}
                                {lines.length === 0 && '-'}
                              </td>
                            )
                          })}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            })()}

            {Object.entries(
              detail.products.reduce<Record<string, typeof detail.products>>((acc, p) => {
                if (!acc[p.supplierName]) acc[p.supplierName] = []
                acc[p.supplierName].push(p)
                return acc
              }, {})
            ).map(([supplierName, products]) => {
              const isOpen = openSuppliers.has(supplierName)
              const supplierOrderStatus = getSupplierOrderStatusFromSap({
                sapOrderNoBySupplier: detail.sapOrderNoBySupplier,
                supplierName,
                fallbackOrderStatus: detail.orderStatus,
              })
              const costDiscount =
                detail.supplierSummary?.find((s) => s.supplier === supplierName)?.costDiscount ?? '-'
              const expectedDelivery = products[0]?.expectedDeliveryDate ?? '-'
              const deliverySlots = detail.supplierDeliverySlots?.[supplierName]
              const hasFactoryRegionSlots =
                deliverySlots != null &&
                (deliverySlots.factory != null || deliverySlots.region != null)
              return (
                <div key={supplierName} className={styles.supplierBlock}>
                  <div className={styles.supplierRow}>
                    <button
                      type="button"
                      className={styles.supplierHeader}
                      onClick={() => toggleSupplier(supplierName)}
                      aria-expanded={isOpen}
                    >
                      <span className={styles.supplierName}>{supplierName}</span>
                      <span
                        className={`${styles.supplierArrow} ${
                          isOpen ? styles.supplierArrowOpen : ''
                        }`}
                      >
                        ›
                      </span>
                    </button>
                    <div className={styles.supplierShippingCol}>
                      <span className={styles.supplierShippingLabel}>배송 예정일</span>
                      <div className={styles.supplierShippingBody}>
                        {deliverySlots?.simple != null ? (
                          <span className={styles.supplierShippingSlotDate}>{deliverySlots.simple}</span>
                        ) : hasFactoryRegionSlots && deliverySlots ? (
                          <div className={styles.supplierShippingSplit}>
                            {deliverySlots.factory != null && (
                              <div className={styles.supplierShippingSplitBlock}>
                                <span className={styles.shipmentPillFactory}>공장</span>
                                <span className={styles.supplierShippingSlotDate}>
                                  {deliverySlots.factory}
                                </span>
                              </div>
                            )}
                            {deliverySlots.factory != null && deliverySlots.region != null && (
                              <div className={styles.supplierShippingDivider} aria-hidden />
                            )}
                            {deliverySlots.region != null && (
                              <div className={styles.supplierShippingSplitBlock}>
                                <span className={styles.shipmentPillRegion}>지역</span>
                                <span className={styles.supplierShippingSlotDate}>
                                  {deliverySlots.region}
                                </span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span>{expectedDelivery}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  {isOpen && (
                    <div className={styles.tableWrap}>
                      <table className={`${styles.detailTable} ${styles.detailTableCenter}`}>
                        <thead>
                          <tr>
                            {hasMultipleSuppliers && <th>출하 구분</th>}
                            {hasMultipleSuppliers && <th>주문상태</th>}
                            <th>공급사</th>
                            <th>구분</th>
                            <th>상품명/규격/단위</th>
                            <th>판매가</th>
                            <th>주문수량</th>
                            <th>비용할인</th>
                            <th>소계금액</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...products]
                            .sort((a, b) => {
                              const pa = getShipmentSortPriority(a, detail, supplierName)
                              const pb = getShipmentSortPriority(b, detail, supplierName)
                              if (pa !== pb) return pa - pb
                              return 0
                            })
                            .map((p, i) => {
                              const resolvedType = p.shipmentType ?? getShipmentTypeFromProductText(p.productSpec)
                              const isFactory = resolvedType === '제약공장 출하'
                              const isRegion = resolvedType === '지역공장 출하'
                              const badgeLabel = isFactory ? '공장' : isRegion ? '지역' : null
                              const shipCol = resolveShipmentColumnCell(p, detail, supplierName)
                              return (
                              <tr key={`${supplierName}-${i}-${p.productSpec}`}>
                                {hasMultipleSuppliers &&
                                  (shipCol === 'omit' ? null : (
                                    <td
                                      className={styles.shipmentColCell}
                                      rowSpan={
                                        shipCol && typeof shipCol === 'object' && shipCol.rowSpan
                                          ? shipCol.rowSpan
                                          : undefined
                                      }
                                    >
                                      {shipCol && typeof shipCol === 'object' ? (
                                        <span
                                          className={
                                            shipCol.badge === '지역'
                                              ? styles.shipmentPillRegion
                                              : styles.shipmentPillFactory
                                          }
                                        >
                                          {shipCol.badge}
                                        </span>
                                      ) : (
                                        <span className={styles.shipmentColEmpty}>-</span>
                                      )}
                                    </td>
                                  ))}
                                {hasMultipleSuppliers && <td>{supplierOrderStatus}</td>}
                                <td>
                                  <div className={styles.supplierCellInner}>
                                    <span>{supplierName ?? '-'}</span>
                                    {!hasMultipleSuppliers && badgeLabel != null && (
                                      <span
                                        className={
                                          isFactory ? styles.shipmentPillFactory : styles.shipmentPillRegion
                                        }
                                      >
                                        {badgeLabel}
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td>{p.category ?? '-'}</td>
                                <td className={styles.cellAllowWrap}>
                                  <div className={styles.productNameCell}>{p.productSpec ?? '-'}</div>
                                  {(p.manufacturer ?? '').trim() && (
                                    <div className={styles.productManufacturer}>{p.manufacturer}</div>
                                  )}
                                </td>
                                <td>{p.sellingPrice ?? '-'}</td>
                                <td>{p.orderQty ?? '-'}</td>
                                <td>{costDiscount}</td>
                                <td>{p.subtotal ?? '-'}</td>
                              </tr>
                            )
                            })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )
            })}
            </div>
          </div>

          <div className={styles.contentSection}>
            <div className={styles.sectionTitleBar}>
              <span className={styles.sectionTitle}>주문 고객정보</span>
            </div>
            <div className={styles.sectionBody}>
            <table className={styles.customerTable}>
              <tbody>
                <tr>
                  <th>받으시는 분</th>
                  <td>{detail.customer.recipient}</td>
                </tr>
                <tr>
                  <th>연락처 / 휴대폰번호</th>
                  <td>{detail.customer.contact}</td>
                </tr>
                <tr>
                  <th>사업자번호</th>
                  <td>{detail.customer.businessNo}</td>
                </tr>
                <tr>
                  <th>요양기관기호</th>
                  <td>{detail.customer.medicalCode}</td>
                </tr>
                <tr>
                  <th>주소</th>
                  <td>{detail.customer.address}</td>
                </tr>
              </tbody>
            </table>
            </div>
          </div>

          <div className={styles.contentSection}>
            <div className={styles.sectionTitleBar}>
              <span className={styles.sectionTitle}>업체 전달 메세지</span>
            </div>
            <div className={styles.sectionBody}>
            <table className={styles.customerTable}>
              <tbody>
                <tr>
                  <th>업체 전달 메세지</th>
                  <td className={styles.messageContent}>{detail.vendorMessage}</td>
                </tr>
              </tbody>
            </table>
            </div>
          </div>

          <div className={styles.contentSection}>
            <div className={styles.sectionTitleBar}>
              <span className={styles.sectionTitle}>관리자 메모</span>
              <span className={styles.memoTitleHint}>운영팀과 소통을 위한 메모입니다.</span>
            </div>
            <div className={styles.sectionBody}>
              <ul className={styles.memoList}>
                {memos.map((memo) => (
                  <li key={memo.id} className={styles.memoItem}>
                    <div className={styles.memoMeta}>
                      <span className={styles.memoAuthor}>{memo.authorName}</span>
                      {memo.authorName === currentUserName && editingMemoId !== memo.id && (
                        <span className={styles.memoActions}>
                          <button type="button" className={styles.btnMemoEdit} onClick={() => handleEditStart(memo.id, memo.content)}>수정</button>
                          <button type="button" className={styles.btnMemoDelete} onClick={() => handleDeleteMemo(memo.id)}>삭제</button>
                        </span>
                      )}
                    </div>
                    {editingMemoId === memo.id ? (
                      <div className={styles.memoEditWrap}>
                        <textarea
                          className={styles.memoTextarea}
                          value={editingContent}
                          onChange={(e) => setEditingContent(e.target.value)}
                          rows={3}
                        />
                        <div className={styles.memoEditActions}>
                          <button type="button" className={styles.btnMemoSave} onClick={handleEditSave}>저장</button>
                          <button type="button" className={styles.btnMemoCancel} onClick={handleEditCancel}>취소</button>
                        </div>
                      </div>
                    ) : (
                      <div className={styles.memoContent}>{memo.content}</div>
                    )}
                  </li>
                ))}
              </ul>
              <div className={styles.memoAddWrap}>
                <textarea
                  className={styles.memoTextarea}
                  placeholder="메모를 입력하세요"
                  value={newMemoContent}
                  onChange={(e) => setNewMemoContent(e.target.value)}
                  rows={3}
                />
                <button type="button" className={styles.btnMemoAdd} onClick={handleAddMemo}>메모 등록</button>
              </div>
            </div>
          </div>

          {partialCancelRecords.length > 0 && (
            <div className={styles.contentSection}>
              <div className={styles.partialCancelHistoryHeader}>
                <div className={styles.sectionTitleBar}>
                  <span className={styles.sectionTitleIconPartial} aria-hidden />
                  <span className={styles.sectionTitle}>부분취소 내역</span>
                </div>
                <button type="button" className={styles.btnAccumHistory} onClick={() => setShowAccumHistoryModal(true)}>
                  적립내역보기
                </button>
              </div>
              <div className={styles.sectionBody}>
                <div className={styles.tableWrap}>
                  <table className={styles.detailTable}>
                    <thead>
                      <tr>
                        <th>공급사명</th>
                        <th>상품명/규격/단위</th>
                        <th>제조사</th>
                        <th>판매가</th>
                        <th>주문수량</th>
                        <th>취소/반품 수량</th>
                        <th>예치금 적립금액</th>
                        <th>마일리지 적립금액</th>
                        <th>카드취소액</th>
                      </tr>
                    </thead>
                    <tbody>
                      {partialCancelRecords.map((r) => (
                        <tr key={r.id}>
                          <td>{r.supplierName}</td>
                          <td>{r.productSpec}</td>
                          <td>{r.manufacturer}</td>
                          <td>{r.sellingPrice}{r.sellingPrice && !/원\s*$/.test(String(r.sellingPrice)) ? ' 원' : ''}</td>
                          <td>{r.orderQty}{r.orderQty && !/개\s*$/.test(String(r.orderQty)) ? '개' : ''}</td>
                          <td>{r.cancelReturnQty}</td>
                          <td>{r.depositAccum}</td>
                          <td>{r.mileageAccum}</td>
                          <td>{r.cardCancelAmount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {(() => {
                  const totalDeposit = partialCancelRecords.reduce((s, r) => s + parseInt(String(r.depositAccum).replace(/[,\s원]/g, ''), 10), 0)
                  const totalMileage = partialCancelRecords.reduce((s, r) => s + parseInt(String(r.mileageAccum).replace(/[,\s원]/g, ''), 10), 0)
                  const totalCard = partialCancelRecords.reduce((s, r) => s + parseInt(String(r.cardCancelAmount).replace(/[,\s원]/g, ''), 10), 0)
                  const totalAccum = totalDeposit + totalMileage + totalCard
                  return (
                    <div className={styles.partialCancelSummary}>
                      총적립금액 {totalAccum.toLocaleString()}원 (총예치금적립 {totalDeposit.toLocaleString()}원, 회수택배비사용 0원, 총마일리지적립 {totalMileage.toLocaleString()}원, 총카드취소액 {totalCard.toLocaleString()}원)
                    </div>
                  )
                })()}
              </div>
            </div>
          )}

          {partialCancelConfirmOpen && (
            <div
              className={styles.partialCancelConfirmOverlay}
              role="dialog"
              aria-modal="true"
              aria-labelledby="partial-cancel-confirm-title"
              onClick={() => setPartialCancelConfirmOpen(false)}
            >
              <div
                className={styles.partialCancelConfirmBox}
                onClick={(e) => e.stopPropagation()}
              >
                <h3 id="partial-cancel-confirm-title" className={styles.partialCancelConfirmTitle}>
                  부분취소 확인
                </h3>
                <p className={styles.partialCancelConfirmLead}>
                  아래 내용으로 부분취소를 진행합니다. 내용을 확인해 주세요.
                </p>
                <ul className={styles.partialCancelConfirmList}>
                  {partialCancelPendingRecords.map((r) => (
                    <li key={r.id} className={styles.partialCancelConfirmItem}>
                      <div className={styles.partialCancelConfirmRow}>
                        <span className={styles.partialCancelConfirmLabel}>상품명</span>
                        <span className={styles.partialCancelConfirmValue}>{r.productSpec}</span>
                      </div>
                      <div className={styles.partialCancelConfirmRow}>
                        <span className={styles.partialCancelConfirmLabel}>기존 주문 수량</span>
                        <span className={styles.partialCancelConfirmValue}>{r.orderQty}</span>
                      </div>
                      <div className={styles.partialCancelConfirmRow}>
                        <span className={styles.partialCancelConfirmLabel}>취소 주문 수량</span>
                        <span className={styles.partialCancelConfirmValue}>{r.cancelReturnQty}</span>
                      </div>
                      <div className={styles.partialCancelConfirmRow}>
                        <span className={styles.partialCancelConfirmLabel}>적립금액</span>
                        <span className={styles.partialCancelConfirmValue}>{r.depositAccum}</span>
                      </div>
                    </li>
                  ))}
                </ul>
                <p className={styles.partialCancelConfirmQuestion}>정말 부분취소하시겠습니까?</p>
                <div className={styles.partialCancelConfirmActions}>
                  <button
                    type="button"
                    className={styles.btnPartialCancelConfirmOk}
                    onClick={confirmPartialCancelSave}
                  >
                    확인
                  </button>
                  <button
                    type="button"
                    className={styles.btnPartialCancelConfirmCancel}
                    onClick={() => setPartialCancelConfirmOpen(false)}
                  >
                    취소
                  </button>
                </div>
              </div>
            </div>
          )}

          <AccumHistoryModal
            open={showAccumHistoryModal}
            onClose={() => setShowAccumHistoryModal(false)}
            records={partialCancelRecords.map((r) => ({
              id: r.id,
              supplierName: r.supplierName,
              productSpec: r.productSpec,
              cancelReturnQty: r.cancelReturnQty,
              depositAccum: r.depositAccum,
              returnShippingAmount: '0원',
              cardCancelAmount: r.cardCancelAmount,
            }))}
            orderDateTime={detail.orderDateTime}
            registrant={currentUserName}
          />
        </div>
      </div>
    </div>
  )
}
