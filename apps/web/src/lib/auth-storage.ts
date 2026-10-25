export function getAccessToken() {
  return localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');
}

export function clearAccessToken() {
  localStorage.removeItem('accessToken');
  sessionStorage.removeItem('accessToken');
}

export function saveAccessToken(token: string, remember: boolean) {
  clearAccessToken();
  (remember ? localStorage : sessionStorage).setItem('accessToken', token);
}
