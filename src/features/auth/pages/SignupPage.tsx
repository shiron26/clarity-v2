import { useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router'
import { Logo } from '../../../components/brand/Logo'
import { MailIcon } from '../../../components/icons/MailIcon'
import { Alert } from '../../../components/ui/Alert'
import { Button } from '../../../components/ui/Button'
import { Field } from '../../../components/ui/Field'
import { PasswordField } from '../../../components/ui/PasswordField'
import { authErrorMessage } from '../../../lib/errorMessage'
import { supabase } from '../../../lib/supabase'
import { AuthScreen } from '../components/AuthScreen'
import { PasswordStrength } from '../components/PasswordStrength'
import { SignupAside } from '../components/SignupAside'
import { useAuth } from '../useAuth'

// Bandeau bleu affiché à la place du panneau latéral sur petit écran.
function SignupBanner() {
  return (
    <div className="bg-primary px-6 pt-8 pb-7">
      <Logo tone="onPrimary" size="md" />
      <p className="mt-5 text-[18px] leading-[1.35] font-semibold text-white">
        Choisissez trois objectifs qui comptent vraiment.
      </p>
    </div>
  )
}

export function SignupPage() {
  const { status } = useAuth()
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [checkEmail, setCheckEmail] = useState(false)

  // Connexion immédiate en local (confirmations off) : SIGNED_IN arrive via
  // onAuthStateChange et ce Navigate prend le relais.
  if (status === 'signedIn') return <Navigate to="/" replace />

  if (checkEmail) {
    return (
      <AuthScreen>
        <div className="flex flex-col items-center text-center">
          <span className="flex size-13 items-center justify-center rounded-xl bg-primary text-white">
            <MailIcon />
          </span>
          <h1 className="mt-6 text-[26px] leading-tight font-semibold tracking-[-0.3px]">
            Vérifie tes emails
          </h1>
          <p className="mt-3 text-ui leading-relaxed text-ink-faint">
            Un lien de confirmation a été envoyé à <span className="text-ink-2">{email}</span>.
          </p>
          <Link
            to="/login"
            className="mt-8 text-body font-medium text-primary transition-colors hover:text-primary-hover"
          >
            Retour à la connexion
          </Link>
        </div>
      </AuthScreen>
    )
  }

  const mismatch = passwordConfirm.length > 0 && password !== passwordConfirm

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (password !== passwordConfirm) return
    setError(null)
    setSubmitting(true)
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      // display_name lu par le trigger DB on_auth_user_created (raw_user_meta_data)
      options: { data: { display_name: displayName } },
    })
    setSubmitting(false)
    if (signUpError) {
      console.error('[auth] signUp', signUpError)
      setError(authErrorMessage(signUpError))
      return
    }
    // Hosted : confirmation email active → pas de session à l'inscription.
    // identities vide = email déjà pris (réponse obfusquée) : même message,
    // on ne révèle pas l'existence du compte.
    if (data.user && !data.session) {
      setCheckEmail(true)
    }
  }

  return (
    <AuthScreen
      aside={<SignupAside />}
      asideSide="left"
      asideClassName="bg-primary"
      mobileBanner={<SignupBanner />}
    >
      <h1 className="animate-auth-in text-display leading-tight font-semibold tracking-[-0.4px]">
        Créer votre compte
      </h1>
      <p className="animate-auth-in mt-2 text-ui text-ink-faint [animation-delay:0.05s]">
        Deux minutes pour poser vos objectifs de l’année.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-[15px]">
        <Field
          label="Nom"
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Camille Durand"
          autoComplete="name"
          required
        />

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
          placeholder="8 caractères minimum"
          autoComplete="new-password"
          minLength={8}
          required
          footer={<PasswordStrength password={password} />}
        />

        <Field
          label="Confirmer le mot de passe"
          type="password"
          value={passwordConfirm}
          onChange={(e) => setPasswordConfirm(e.target.value)}
          placeholder="••••••••"
          autoComplete="new-password"
          required
          tone={passwordConfirm && !mismatch ? 'ok' : 'default'}
          error={mismatch ? 'Les mots de passe ne correspondent pas' : null}
        />

        {error && <Alert>{error}</Alert>}

        <Button
          type="submit"
          size="lg"
          loading={submitting}
          disabled={submitting || mismatch}
          fullWidth
          className="mt-1"
        >
          {submitting ? 'Création…' : 'Créer mon compte'}
        </Button>
      </form>

      <p className="mt-6 text-center text-body text-ink-faint">
        Déjà un compte ?{' '}
        <Link
          to="/login"
          className="font-medium text-primary transition-colors hover:text-primary-hover"
        >
          Se connecter
        </Link>
      </p>
    </AuthScreen>
  )
}
