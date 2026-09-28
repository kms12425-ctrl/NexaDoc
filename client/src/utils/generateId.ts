export const generateId = (name: string): string => {
  return name.replace(/\s+/g, '-') + '-' + Date.now()
}
