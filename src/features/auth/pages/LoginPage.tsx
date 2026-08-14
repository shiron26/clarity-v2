import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router'
import { Logo } from '../../../components/brand/Logo'
import { Alert } from '../../../components/ui/Alert'
import { Button } from '../../../components/ui/Button'
import { Checkbox } from '../../../components/ui/Checkbox'
import { Field } from '../../../components/ui/Field'
import { PasswordField } from '../../../components/ui/PasswordField'
import { setRemember } from '../../../lib/authStorage'
import { isStandalone } from '../../../lib/displayMode'
import { authErrorMessage } from '../../../lib/errorMessage'
import { supabase } from '../../../lib/supabase'
import { AuthScreen } from '../components/AuthScreen'
import { LoginAside } from '../components/LoginAside'
import { useAuth } from '../useAuth'

export function LoginPage() {
  const { status } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRememberState] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  // En app installée, « Rester connecté » n'a plus d'objet : la case protège un
  // navigateur partagé, pas une app posée sur un écran d'accueil. Voir getRemember().
  const standalone = isStandalone()

  if (status === 'signedIn') return <Navigate to="/" replace />

  const from = (location.state as { from?: string } | null)?.from ?? '/'

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    // Doit précéder l'appel : le storage lit le drapeau au moment où la session est écrite.
    // Rien à écrire en standalone : getRemember() y ignore le drapeau, et un '0'
    // résiduel s'appliquerait au retour dans un onglet navigateur.
    if (!standalone) setRemember(remember)
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    setSubmitting(false)
    if (signInError) {
      console.error('[auth] signInWithPassword', signInError)
      setError(authErrorMessage(signInError))
      return
    }
    navigate(from, { replace: true })
  }

  return (
    <AuthScreen aside={<LoginAside />} asideSide="right" asideClassName="bg-night">
      <Logo tone="solid" size="lg" className="mb-11" />

      <h1 className="animate-auth-in text-display leading-tight font-semibold tracking-[-0.4px]">
        Content de vous revoir
      </h1>
      <p className="animate-auth-in mt-2 text-ui text-ink-faint [animation-delay:0.05s]">
        Reprenez vos objectifs là où vous les avez laissés.
      </p>

      <form onSubmit={handleSubmit} className="mt-9 flex flex-col gap-4">
        <Field
          label="Adresse email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="vous@exemple.com"
          autoComplete="email"
          required
        />

        <PasswordField
          label="Mot de passe"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          autoComplete="current-password"
          required
        />

        {standalone ? (
          <p className="text-body text-ink-faint">Vous restez connecté sur cet appareil.</p>
        ) : (
          <Checkbox
            label="Rester connecté"
            checked={remember}
            onChange={(e) => setRememberState(e.target.checked)}
          />
        )}

        {error && <Alert>{error}</Alert>}

        <Button type="submit" size="lg" loading={submitting} fullWidth className="mt-1">
          {submitting ? 'Connexion…' : 'Se connecter'}
        </Button>
      </form>

      <p className="mt-6 text-center text-body text-ink-faint">
        Pas encore de compte ?{' '}
        <Link
          to="/signup"
          className="font-medium text-primary transition-colors hover:text-primary-hover"
        >
          Créer un compte
        </Link>
      </p>
    </AuthScreen>
  )
}
