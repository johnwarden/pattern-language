import { createHighlighterCore } from 'shiki/core';
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript';
import grammar from '../../editors/highlighting/textmate/pattern-language.tmLanguage.json' with { type: 'json' };

export type PatternToken = { content:string; color?:string; fontStyle?:number };
export const patternTheme = {
  name:'pattern-tour-light',
  type:'light' as const,
  colors:{'editor.background':'#fbfaf7','editor.foreground':'#263238'},
  tokenColors:[
    {scope:'comment',settings:{foreground:'#687580'}},
    {scope:'string',settings:{foreground:'#7B5900'}},
    {scope:'constant.character.escape',settings:{foreground:'#875F00'}},
    {scope:'constant.numeric',settings:{foreground:'#9C4B00'}},
    {scope:'entity.name.type, support.type',settings:{foreground:'#006B88'}},
    {scope:'keyword.control, keyword.other.test, storage.type',settings:{foreground:'#7A3EAC'}},
    {scope:'constant.other.symbol',settings:{foreground:'#426F13'}},
    {scope:'constant.language',settings:{foreground:'#A52B64'}},
    {scope:'entity.name.function.reader, entity.name.tag',settings:{foreground:'#325E9B'}},
    {scope:'keyword.operator, punctuation',settings:{foreground:'#5B6370'}},
    {scope:'variable.other',settings:{foreground:'#263238'}},
  ],
};

// The grammar is the same generated TextMate artifact used by the language's
// Markdown and editor packages. The JavaScript engine avoids a WASM download.
let ready:ReturnType<typeof createHighlighterCore>|undefined;
export function getPatternHighlighter(){
  return ready??=createHighlighterCore({
    themes:[patternTheme],
    langs:[{...grammar,name:'pattern-language',aliases:['pattern']}],
    engine:createJavaScriptRegexEngine(),
  });
}

export async function highlightPattern(source:string):Promise<PatternToken[][]>{
  const highlighter=await getPatternHighlighter();
  // TextMate treats LF as the logical boundary. Preserve original newline bytes
  // separately in the flat adapter, including CR-only text pasted from elsewhere.
  return highlighter.codeToTokens(source.replace(/\r\n|\r/g,'\n'),{lang:'pattern-language',theme:patternTheme.name}).tokens;
}

/** Preserve every original newline as well as every highlighted character. */
export async function highlightPatternFlat(source:string):Promise<PatternToken[]>{
  const lines=await highlightPattern(source),breaks=source.match(/\r\n|\r|\n/g)||[];
  const result:PatternToken[]=[];
  for(let i=0;i<lines.length;i++){
    result.push(...lines[i]);
    if(i<breaks.length)result.push({content:breaks[i]});
  }
  return result;
}
