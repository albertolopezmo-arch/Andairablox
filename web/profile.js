export const PROFILE_KEY='quiz-lqsa-profile-v1';
export const AVATAR_IDS=Array.from({length:28},(_,i)=>`avatar-${i+1}`);
export function avatarAssetPath(id){return `avatars/${id}-${Number(id.slice(7))>15?'comic':'cream'}.webp`;}
export function validateAlias(value){
 const alias=String(value||'').trim().normalize('NFC');
 if(alias.length<3||alias.length>20)return 'El alias debe tener entre 3 y 20 caracteres.';
 if(!/^[\p{L}\p{N} ._-]+$/u.test(alias))return 'Usa letras, números, espacios, puntos, guiones o guion bajo.';
 return '';
}
export function loadProfile(storage){
 try{const value=JSON.parse(storage.getItem(PROFILE_KEY)||'null');
 return value?.version===1&&!validateAlias(value.alias)&&AVATAR_IDS.includes(value.avatar)?value:null;
 }catch{return null;}
}
export function saveProfile(storage,alias,avatar){
 const error=validateAlias(alias);if(error)throw new Error(error);
 if(!AVATAR_IDS.includes(avatar))throw new Error('Elige un avatar para continuar.');
 const profile={version:1,alias:alias.trim().normalize('NFC'),avatar};
 storage.setItem(PROFILE_KEY,JSON.stringify(profile));return profile;
}
export function suggestAlias(){
 const words=['Vecino','Cuqui','Capitán','Recrecio','Marquesa','Presidente','Conserje','Moroso'];
 return words[Math.floor(Math.random()*words.length)]+Math.floor(100+Math.random()*900);
}
