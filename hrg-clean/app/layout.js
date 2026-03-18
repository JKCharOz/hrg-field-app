import './globals.css'

export const metadata = {
  title: 'HRG Field App',
  description: 'Daily observation reporting for civil construction inspectors',
}

export default function RootLayout(props) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0, background: '#020617' }}>
        {props.children}
      </body>
    </html>
  )
}
