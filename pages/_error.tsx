// Pages Router エラーページ（Next.jsの内部_errorページ生成エラーを回避するため）
// <Html>を使わない最小限の実装
function Error({ statusCode }: { statusCode?: number }) {
  return (
    <p>
      {statusCode
        ? `サーバーエラー: ${statusCode}`
        : 'クライアントエラーが発生しました'}
    </p>
  )
}

Error.getInitialProps = ({ res, err }: {
  res?: { statusCode?: number }
  err?: { statusCode?: number }
}) => {
  const statusCode = res ? res.statusCode : err ? err.statusCode : 404
  return { statusCode }
}

export default Error
