import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    console.error('Ett fel inträffade i gränssnittet:', error, info)
  }

  handleReload = () => {
    this.setState({ hasError: false })
    window.location.assign('/')
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="center-screen">
          <div className="card error-card">
            <h1 className="page-title">Något gick fel</h1>
            <p className="muted">
              En del av appen kraschade. Din data är trygg – ladda om så försöker vi igen.
            </p>
            <button className="btn primary" onClick={this.handleReload}>
              Ladda om appen
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
