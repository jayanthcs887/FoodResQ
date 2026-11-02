import { Link } from 'react-router-dom'
import * as Icons from 'lucide-react'

export function AccessCard() { return <div className="access-card"><span><Icons.Shield size={24} /></span><h2>This area has a different key.</h2><p>Your current account type cannot open this section. If you think this is a mistake, ask a platform administrator.</p><Link to="/app" className="button button-dark">Back to your workspace <Icons.ArrowRight size={15} /></Link></div> }
