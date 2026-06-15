const numberFormatter = new Intl.NumberFormat('ko-KR', {
  notation: 'compact',
  maximumFractionDigits: 1,
})

function formatNumber(value) {
  return numberFormatter.format(Number(value) || 0)
}

export default formatNumber
