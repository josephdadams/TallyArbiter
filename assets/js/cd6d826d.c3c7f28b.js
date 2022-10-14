"use strict";(self.webpackChunktallyarbiter_docs=self.webpackChunktallyarbiter_docs||[]).push([[457],{3905:function(e,t,r){r.d(t,{Zo:function(){return u},kt:function(){return f}});var n=r(7294);function a(e,t,r){return t in e?Object.defineProperty(e,t,{value:r,enumerable:!0,configurable:!0,writable:!0}):e[t]=r,e}function o(e,t){var r=Object.keys(e);if(Object.getOwnPropertySymbols){var n=Object.getOwnPropertySymbols(e);t&&(n=n.filter((function(t){return Object.getOwnPropertyDescriptor(e,t).enumerable}))),r.push.apply(r,n)}return r}function i(e){for(var t=1;t<arguments.length;t++){var r=null!=arguments[t]?arguments[t]:{};t%2?o(Object(r),!0).forEach((function(t){a(e,t,r[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(r)):o(Object(r)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(r,t))}))}return e}function l(e,t){if(null==e)return{};var r,n,a=function(e,t){if(null==e)return{};var r,n,a={},o=Object.keys(e);for(n=0;n<o.length;n++)r=o[n],t.indexOf(r)>=0||(a[r]=e[r]);return a}(e,t);if(Object.getOwnPropertySymbols){var o=Object.getOwnPropertySymbols(e);for(n=0;n<o.length;n++)r=o[n],t.indexOf(r)>=0||Object.prototype.propertyIsEnumerable.call(e,r)&&(a[r]=e[r])}return a}var s=n.createContext({}),p=function(e){var t=n.useContext(s),r=t;return e&&(r="function"==typeof e?e(t):i(i({},t),e)),r},u=function(e){var t=p(e.components);return n.createElement(s.Provider,{value:t},e.children)},c={inlineCode:"code",wrapper:function(e){var t=e.children;return n.createElement(n.Fragment,{},t)}},d=n.forwardRef((function(e,t){var r=e.components,a=e.mdxType,o=e.originalType,s=e.parentName,u=l(e,["components","mdxType","originalType","parentName"]),d=p(r),f=a,y=d["".concat(s,".").concat(f)]||d[f]||c[f]||o;return r?n.createElement(y,i(i({ref:t},u),{},{components:r})):n.createElement(y,i({ref:t},u))}));function f(e,t){var r=arguments,a=t&&t.mdxType;if("string"==typeof e||a){var o=r.length,i=new Array(o);i[0]=d;var l={};for(var s in t)hasOwnProperty.call(t,s)&&(l[s]=t[s]);l.originalType=e,l.mdxType="string"==typeof e?e:a,i[1]=l;for(var p=2;p<o;p++)i[p]=r[p];return n.createElement.apply(null,i)}return n.createElement.apply(null,r)}d.displayName="MDXCreateElement"},6284:function(e,t,r){r.r(t),r.d(t,{default:function(){return c},frontMatter:function(){return l},metadata:function(){return s},toc:function(){return p}});var n=r(3117),a=r(102),o=(r(7294),r(3905)),i=["components"],l={sidebar_position:1},s={unversionedId:"installation/desktop-app",id:"installation/desktop-app",isDocsHomePage:!1,title:"Desktop Application / Installer",description:"Installation",source:"@site/docs/installation/desktop-app.md",sourceDirName:"installation",slug:"/installation/desktop-app",permalink:"/TallyArbiter/docs/installation/desktop-app",editUrl:"https://github.com/josephdadams/TallyArbiter/edit/master/docs/docs/installation/desktop-app.md",version:"current",sidebarPosition:1,frontMatter:{sidebar_position:1},sidebar:"tutorialSidebar",previous:{title:"Introduction",permalink:"/TallyArbiter/docs/intro"},next:{title:"CLI",permalink:"/TallyArbiter/docs/installation/cli"}},p=[{value:"Installation",id:"installation",children:[]},{value:"Upgrading",id:"upgrading",children:[]}],u={toc:p};function c(e){var t=e.components,r=(0,a.Z)(e,i);return(0,o.kt)("wrapper",(0,n.Z)({},u,r,{components:t,mdxType:"MDXLayout"}),(0,o.kt)("h2",{id:"installation"},"Installation"),(0,o.kt)("p",null,"This is the easiest method and recommanded for users with less terminal experience. Just go to the ",(0,o.kt)("a",{parentName:"p",href:"https://github.com/josephdadams/TallyArbiter/releases"},"Releases")," page, grab the latest installer for Windows, MacOS or Linux, run it and you're ready to use TallyArbiter! After installation you can run it just like any other program."),(0,o.kt)("h2",{id:"upgrading"},"Upgrading"),(0,o.kt)("p",null,"On Windows as well Linux the autoupdater is available. It will prompt you automatically once there is a new version available."),(0,o.kt)("p",null,"If you're running MacOS, there's unfortunately no way around manually ",(0,o.kt)("a",{parentName:"p",href:"https://github.com/josephdadams/TallyArbiter/releases"},"downloading the latest release"),". This is due to Apple requiring apps to be signed in order for the autoupdater to work. For that, we'd need an Apple Developer Account which is about $100 a year which  (as an open-source project) cannot afford. Maybe you want to sponsor us? \ud83d\ude09"),(0,o.kt)("p",null,(0,o.kt)("strong",{parentName:"p"},"Be sure to back up or save your ",(0,o.kt)("a",{parentName:"strong",href:"/TallyArbiter/docs/usage/control-interface#configuration"},"config file"),"!")))}c.isMDXComponent=!0}}]);