import { GoogleLogin } from '@react-oauth/google';

export default function GoogleLoginButton({ onSuccess, onError }) {
  return (
    <div className="w-full">
      <GoogleLogin
        onSuccess={(response) => {
          const credential = response?.credential;
          if (!credential) {
            return onError?.(new Error('Google did not return an ID token.'));
          }
          onSuccess(credential);
        }}
        onError={() => onError?.(new Error('Google authentication failed.'))}
        useOneTap={false}
        text="continue_with"
      />
    </div>
  );
}
