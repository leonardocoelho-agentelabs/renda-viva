/**
 * Normaliza número de telefone brasileiro para o formato DDD+número (10-11 dígitos),
 * removendo o código do país 55 se presente.
 */
export function normalizarTelefone(numero: string): string {
  const digitos = numero.replace(/\D/g, '')
  // Se tiver 12-13 dígitos e começar com 55, remover o código do país
  if (digitos.length >= 12 && digitos.startsWith('55')) {
    return digitos.slice(2)
  }
  return digitos
}
