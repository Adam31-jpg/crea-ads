export default function NotFound() {
    return (
        <html>
            <body style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'system-ui, sans-serif', background: '#0a0a0a', color: '#fff', margin: 0 }}>
                <div style={{ textAlign: 'center' }}>
                    <h1 style={{ fontSize: '4rem', fontWeight: 'bold', margin: 0 }}>404</h1>
                    <p style={{ color: '#888', marginTop: '0.5rem' }}>Page introuvable</p>
                    <a href="/dashboard" style={{ color: '#f59e0b', marginTop: '1rem', display: 'inline-block', textDecoration: 'none' }}>
                        Retour au dashboard
                    </a>
                </div>
            </body>
        </html>
    );
}
