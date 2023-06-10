export const replaceAll = (str: string, find: string, replace: string): string =>{
  return str.replace(new RegExp(escapeRegExp(find), 'g'), replace);
}

export const escapeRegExp = (str: string): string =>{
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');  // $& means the whole matched string
}