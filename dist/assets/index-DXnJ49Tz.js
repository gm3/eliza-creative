(function(){const s=document.createElement("link").relList;if(s&&s.supports&&s.supports("modulepreload"))return;for(const n of document.querySelectorAll('link[rel="modulepreload"]'))t(n);new MutationObserver(n=>{for(const i of n)if(i.type==="childList")for(const r of i.addedNodes)r.tagName==="LINK"&&r.rel==="modulepreload"&&t(r)}).observe(document,{childList:!0,subtree:!0});function o(n){const i={};return n.integrity&&(i.integrity=n.integrity),n.referrerPolicy&&(i.referrerPolicy=n.referrerPolicy),n.crossOrigin==="use-credentials"?i.credentials="include":n.crossOrigin==="anonymous"?i.credentials="omit":i.credentials="same-origin",i}function t(n){if(n.ep)return;n.ep=!0;const i=o(n);fetch(n.href,i)}})();let f=null;document.addEventListener("DOMContentLoaded",async()=>{await L(),y()});async function L(){try{const e=await fetch("/manifest.json");if(!e.ok)throw new Error(`HTTP error! status: ${e.status}`);f=await e.json()}catch(e){console.error("Error loading manifest:",e);const s=window.location.protocol==="file:"?'Please run "npm run dev" to start the development server. Opening HTML directly from file:// is not supported.':'Error loading file manifest. Make sure to run "npm run build" first to generate manifest.json';document.getElementById("file-tree").innerHTML=`<div class="file-tree-item" style="color: #ff6b6b; padding: 20px;">${s}</div>`}}function y(){const e=document.getElementById("file-tree");e.innerHTML="",f&&Object.keys(f).forEach(s=>{const o=f[s];s==="."?o.forEach(t=>w(t,e,0)):E(s,o,e,0)})}function E(e,s,o,t){const n=document.createElement("div");n.className="file-tree-item directory folder",n.style.paddingLeft=`${12+t*20}px`,n.setAttribute("data-path",e),n.innerHTML=`
        <span class="folder-icon collapsed">📁</span>
        <span>${l(e)}</span>
    `,n.addEventListener("click",i=>{i.stopPropagation(),m(n,e,s)}),o.appendChild(n)}function w(e,s,o){const t=document.createElement("div");t.className=`file-tree-item file ${g(e.name)}`,t.style.paddingLeft=`${12+o*20}px`,t.setAttribute("data-path",e.path),t.textContent=e.name,t.addEventListener("click",n=>{n.stopPropagation(),v(e.path,e.name)}),s.appendChild(t)}function m(e,s,o){const t=e.querySelector(".folder-icon");if(t.classList.contains("expanded")){t.classList.remove("expanded"),t.classList.add("collapsed"),t.textContent="📁",e.parentElement;let i=e.nextSibling;const r=parseInt(e.style.paddingLeft)||0;for(;i&&!((parseInt(i.style.paddingLeft)||0)<=r);){const d=i;i=i.nextSibling,d.remove()}}else{t.classList.remove("collapsed"),t.classList.add("expanded"),t.textContent="📂";const i=e.parentElement,r=e.nextSibling,d=(parseInt(e.style.paddingLeft)||0)+20,p=document.createDocumentFragment();o.forEach(c=>{if(c.type==="directory"){const a=document.createElement("div");a.className="file-tree-item directory folder",a.style.paddingLeft=`${12+d}px`,a.setAttribute("data-path",c.path),a.innerHTML=`
                    <span class="folder-icon collapsed">📁</span>
                    <span>${l(c.name)}</span>
                `,a.addEventListener("click",u=>{u.stopPropagation(),m(a,c.name,c.children||[])}),p.appendChild(a)}else{const a=document.createElement("div");a.className=`file-tree-item file ${g(c.name)}`,a.style.paddingLeft=`${12+d}px`,a.setAttribute("data-path",c.path),a.textContent=c.name,a.addEventListener("click",u=>{u.stopPropagation(),v(c.path,c.name)}),p.appendChild(a)}}),r?i.insertBefore(p,r):i.appendChild(p)}}function v(e,s){var t;document.querySelectorAll(".file-tree-item").forEach(n=>{n.classList.remove("active")});const o=(t=event==null?void 0:event.target)==null?void 0:t.closest(".file-tree-item");o&&o.classList.add("active"),document.getElementById("asset-title").textContent=s,b(e,s)}function b(e,s){const o=document.getElementById("asset-preview");o.innerHTML='<div class="loading">Loading</div>';const t=s.split(".").pop().toLowerCase(),i=`/${e.startsWith("/")?e.substring(1):e}`;let r="";["mp4","webm","mov"].includes(t)?r=`
            <div class="asset-preview">
                <video controls autoplay>
                    <source src="${i}" type="video/${t==="mov"?"quicktime":t}">
                    Your browser does not support the video tag.
                </video>
                <div class="asset-info">
                    <h3>${l(s)}</h3>
                    <p class="asset-path">${l(e)}</p>
                </div>
            </div>
        `:["mp3","wav","ogg","m4a"].includes(t)?r=`
            <div class="asset-preview">
                <audio controls autoplay>
                    <source src="${i}" type="audio/${t==="m4a"?"mp4":t}">
                    Your browser does not support the audio tag.
                </audio>
                <div class="asset-info">
                    <h3>${l(s)}</h3>
                    <p class="asset-path">${l(e)}</p>
                </div>
            </div>
        `:["jpg","jpeg","png","gif","webp"].includes(t)?r=`
            <div class="asset-preview">
                <img src="${i}" alt="${l(s)}">
                <div class="asset-info">
                    <h3>${l(s)}</h3>
                    <p class="asset-path">${l(e)}</p>
                </div>
            </div>
        `:r=`
            <div class="asset-preview">
                <div class="asset-info">
                    <h3>${l(s)}</h3>
                    <p class="asset-path">${l(e)}</p>
                    <p>Preview not available for this file type.</p>
                </div>
            </div>
        `,o.innerHTML=r}function g(e){const s=e.split(".").pop().toLowerCase();return["mp3","wav","ogg","m4a"].includes(s)?"audio":["mp4","webm","mov"].includes(s)?"video":["jpg","jpeg","png","gif","webp"].includes(s)?"image":""}function l(e){const s=document.createElement("div");return s.textContent=e,s.innerHTML}
