'use client';
import { useEffect, useRef, useState } from 'react';
import { highlightPatternFlat } from './pattern-highlight';
import type { PatternToken } from './pattern-highlight';

/** Safe React text nodes, never generated HTML. Suitable for a textarea overlay. */
export function PatternCode({source,onReady}:{source:string;onReady?:()=>void}){
  const onReadyRef=useRef(onReady);
  onReadyRef.current=onReady;
  const [paint,setPaint]=useState<{source:string;tokens:PatternToken[]}|null>(null);
  useEffect(()=>{
    let active=true;
    void highlightPatternFlat(source).then(tokens=>{
      if(!active)return;
      setPaint({source,tokens});
      onReadyRef.current?.();
    }).catch(()=>{
      // Source remains readable if highlighting cannot initialize.
      if(active){setPaint({source,tokens:[{content:source}]});onReadyRef.current?.();}
    });
    return()=>{active=false;};
  },[source]);
  if(!paint||paint.source!==source)return <>{source}</>;
  return <>{paint.tokens.map((token,i)=><span key={i} style={{color:token.color,fontStyle:token.fontStyle&&token.fontStyle&1?'italic':undefined,fontWeight:token.fontStyle&&token.fontStyle&2?'bold':undefined,textDecoration:token.fontStyle&&token.fontStyle&4?'underline':undefined}}>{token.content}</span>)}</>;
}
