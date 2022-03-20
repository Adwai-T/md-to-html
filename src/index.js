const regexJson = "/src/regex.json"
// const stack = new Stack();

let fetchString = '';
let fetchRegex = '';

const fromTextButton = document.getElementById('from-text');
const fromLinkButton = document.getElementById('from-link');
const showHtmlButton = document.getElementById('show-html');
const showPageButton = document.getElementById('show-page');
const textInput= document.getElementById('text-input');
const iframeResultPage = document.getElementById('result-page');
const resultText = document.getElementById('result-html');

let stringMD = '';
let stringHTML = '';
let stringValueAvailable = false;
let regexJSON = {};
let regexReady = false;
let done = false;
const lineStartWith = {
  '#' : "heading",
  '`' : "code",
  '>' : "quote",
  '-' : "list",
  '*' : "list",
  '\n' : "newLine",
  '\r\n' : "newLine",
}

async function load(url, text) {
  if(url) {
    fetchString = fetch(url)
    stringMD = await (await fetchString).text();
    stringValueAvailable = true;
  }else {
    stringMD = text;
  }

  fetchRegex = fetch(regexJson);

  regexJSON = await (await fetchRegex).json();
  regexReady = true;

  while(stringMD.length > 1) {
    process();
  }
  console.log(stringHTML);
  return new Promise((resolve, reject) => {
    resolve(stringHTML);
    reject("SomeThing Went Wrong In Load.");
  });
}

function process() {
  let line = removeAndGetline();
  let lineType = lineStartWith[line[0]];
  // console.log(lineType, line);
  let processedLine = '';

  switch(lineType) {
    case 'heading' : 
      processedLine = isHeading(line);
      stringHTML = stringHTML.concat(processedLine);
      break;
    case 'newLine' : 
      stringHTML = stringHTML.concat('\n');
      break;
    case 'code':
      if(isCodeBlock(line)) break;
    case 'quote' : 
      stringHTML = stringHTML.concat(isQuote(line));
      break;
    case 'list' : 
      isUnOrderedList(line);
      break;
    default :
      if(!isNaN(parseInt(line[0])) && line[1] === '.') {
        isOrderedList(line);
        break;
      }
      line = `<p>${line}</p>`;
      stringHTML = stringHTML.concat(line);
      break;
  }
  return true;
}

function isHeading(line) {
  let count = 0;
  while(line[count] === '#') {
    count++;
  }
  line = line.slice(count+1);//count+1 as `## ` heading have space after
  line = `<h${count}>`.concat(line, `</h${count}>`);
  return line;
}

function isQuote(line) {
  line = line.slice(1);
  return `<quote>${line}</quote>`;
}

function isOrderedList(line) {
  line = line.slice(2);
  line = `<ol>\n\t<li>${line}</li>\n`;
  stringHTML = stringHTML.concat(line);
  line = removeAndGetline();
  while(!isNaN(parseInt(line[0])) && line[1] === '.') {
    line = line.slice(2);
    line = `\t<li>${line}</li>\n`
    stringHTML = stringHTML.concat(line);
    line = removeAndGetline();
  }
  stringHTML = stringHTML.concat('</ol>');
  //Attack back the line that was not part of ordered list
  stringMD = `${line}`.concat(stringMD);
  return;
}

function isUnOrderedList(line) {
  line = line.slice(1);
  line = `<ul>\n\t<li>${line}</li>\n`;
  stringHTML = stringHTML.concat(line);
  line = removeAndGetline();
  while(lineStartWith[line[0]] === 'list') {
    line = line.slice(1);
    line = `\t<li>${line}</li>\n`;
    stringHTML = stringHTML.concat(line);
    line = removeAndGetline();
  }
  stringHTML = stringHTML.concat(`</ul>`);
  //If the next line to list is not newLine we want to put the line back to unprocessed MD String
  stringMD = line.concat(stringMD);
  return;
}


/* 
  Becase the code is shown in html we want to change html special entities with entity names
  < - &lt;
  > - &gt;
  & - &amp;
  " - quot;
  ' - &apos;
*/
const htmlEsacpeCharacters = {
  "<" : "&lt;",
  ">" : "&gt;",
}
function isCodeBlock(line) {
  let count = 0;
  while(line[count] === '`') {
    count++;
  }
  if(count > 2) {
    line = line.slice(count);
    let codeType = line; //What remains after ``` is code type as ```js
    line = `<code><${line}><pre>\n`
    stringHTML = stringHTML.concat(line);
    line = removeAndGetline();
    while(lineStartWith[line[0]] !== 'code') {
      Object.keys(htmlEsacpeCharacters)
      .forEach(key => line = line.replace(key, htmlEsacpeCharacters[key]));
      stringHTML = stringHTML.concat(line).concat('\n');
      line = removeAndGetline();
    }
    line = line.slice(count);
    line = codeType;
    stringHTML = stringHTML.concat(`</pre></${line}></code>`);
    return true;
  }
  return false;
}

function getFirstEndLIndex(string) {
  let regexp = RegExp('\n');
  let match = regexp.exec(string);
  return !match ? null : match.index;
}

function getLine(string) {
  // let stringInput = string ? string : stringMD;
  let indexOfNewLine = getFirstEndLIndex(string);
  if(indexOfNewLine === 0) return '\n';
  let returnValue = string.slice(0, !indexOfNewLine ? 0 : indexOfNewLine)
  return returnValue;
}


function removeAndGetline() {
  let line = getLine(stringMD);
  removeLine();
  return line;
}

function removeLine() {
  let indexOfNewLine = getFirstEndLIndex(stringMD);
  stringMD = stringMD.slice(indexOfNewLine+1);
}

function matchAllRegex(string, regexJson) {
  let regexp = RegExp(regexJson.regex, regexJson.flags);
  return string.matchAll(regexp);
}

function matchRegex(string, regexJson) {
  let regexp = RegExp(regexJson.regex, regexJson.flags);
  return string.match(regexp);
}

fromTextButton.onclick= ()=> {
  let text = textInput.value;
  load(undefined, text).then(result => {
    resultText.value = result
    iframeResultPage.contentWindow.document.body.innerHTML = result;
  });
}

fromLinkButton.onclick= ()=> {
  let link = textInput.value;
  load(link).then(result => {
    resultText.value = result
    iframeResultPage.contentWindow.document.body.innerHTML = result;
  });
}

showPageButton.onclick= ()=> {
  iframeResultPage.style.display = 'block';
  resultText.style.display = 'none';
}

showHtmlButton.onclick= ()=> {
  iframeResultPage.style.display = 'none';
  resultText.style.display = 'block';
}