import styles from './AccumHistoryModal.module.css'

export type AccumHistoryRecord = {
  id: string
  supplierName: string
  productSpec: string
  cancelReturnQty: string
  depositAccum: string
  returnShippingAmount: string
  cardCancelAmount: string
}

type AccumHistoryModalProps = {
  open: boolean
  onClose: () => void
  records: AccumHistoryRecord[]
  orderDateTime: string
  registrant: string
}

function parseAmount(s: string): number {
  const n = parseInt(String(s).replace(/[,\s원]/g, ''), 10)
  return Number.isNaN(n) ? 0 : n
}

function toDateOnly(dateTimeStr: string): string {
  const part = dateTimeStr.trim().split(/\s/)[0]
  return part || dateTimeStr.slice(0, 10)
}

export default function AccumHistoryModal({
  open,
  onClose,
  records,
  orderDateTime,
  registrant,
}: AccumHistoryModalProps) {
  if (!open) return null

  const paymentDate = toDateOnly(orderDateTime)
  const totalDeposit = records.reduce((s, r) => s + parseAmount(r.depositAccum), 0)
  const totalReturnShipping = records.reduce((s, r) => s + parseAmount(r.returnShippingAmount || '0'), 0)
  const totalCard = records.reduce((s, r) => s + parseAmount(r.cardCancelAmount), 0)

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>
            <span className={styles.titleIcon} aria-hidden />
            예치금/마일리지 적립정보
          </h2>
          <button type="button" className={styles.btnClose} onClick={onClose} aria-label="닫기">
            ×
          </button>
        </div>
        <div className={styles.body}>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>공급사명</th>
                  <th>상품명/규격/단위</th>
                  <th className={styles.numCol}>취소/반품수량</th>
                  <th className={styles.numCol}>예치금 적립금액</th>
                  <th className={styles.numCol}>회수택배비 사용금액</th>
                  <th className={styles.numCol}>카드취소액</th>
                  <th>결제일</th>
                  <th>적립/취소일</th>
                  <th>등록자</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r, i) => (
                  <tr key={r.id} className={i % 2 === 1 ? styles.rowAlt : undefined}>
                    <td>{r.supplierName}</td>
                    <td>{r.productSpec}</td>
                    <td className={styles.numCol}>{r.cancelReturnQty}</td>
                    <td className={styles.numCol}>{r.depositAccum}</td>
                    <td className={styles.numCol}>{r.returnShippingAmount ?? '0원'}</td>
                    <td className={styles.numCol}>{r.cardCancelAmount}</td>
                    <td>{paymentDate}</td>
                    <td>{paymentDate}</td>
                    <td>{registrant}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className={styles.summaryRow}>
                  <td colSpan={2} className={styles.summaryLabel}>
                    총적립금액
                  </td>
                  <td className={styles.numCol} />
                  <td className={styles.numCol}>{totalDeposit.toLocaleString()} 원</td>
                  <td className={styles.numCol}>{totalReturnShipping.toLocaleString()} 원</td>
                  <td className={styles.numCol}>{totalCard.toLocaleString()} 원</td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
