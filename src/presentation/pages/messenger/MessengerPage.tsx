import MessengerPageContent from '../../components/messenger/MessengerPageContent'

export default function MessengerPage() {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0, height: '100%', overflow: 'hidden', background: '#FFFFFF' }}>
      <MessengerPageContent />
    </div>
  )
}
