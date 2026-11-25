/** Identify the deployed entry loaded by this tab, including a tab left open
 * across a deploy. No hostname, URL parameters, local paths or model names. */
export function stageBuild(surface:'stage'|'cloth'){
  if(typeof document==='undefined')return null;
  const prefix=surface==='stage'?'/assets/':'/labs/cloth/assets/';
  for(const script of document.querySelectorAll<HTMLScriptElement>('script[type="module"][src]')){
    const url=new URL(script.src,document.baseURI);if(url.origin!==location.origin||!url.pathname.startsWith(prefix))continue;
    const file=url.pathname.slice(prefix.length);if(/^index-[A-Za-z0-9_-]{8,16}\.js$/.test(file))return file;
  }
  return null;
}
