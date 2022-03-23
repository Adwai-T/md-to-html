const regexFileLink = "/src/regex.json"
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
  '|' : "tableRow"
}

async function load(url, text) {
  if(url) {
    fetchString = fetch(url)
    stringMD = await (await fetchString).text();
    stringValueAvailable = true;
  }else {
    stringMD = text;
  }

  fetchRegex = fetch(regexFileLink);

  regexJSON = await (await fetchRegex).json();
  regexReady = true;

  //--- Work on elements like headings, lists, code
  //that occur at the start of line
  while(stringMD.length > 1) {
    processStartOfLineElements();
  }
  //--- Work on inline elements like links, pictures, bold etc.
  processInlineElements();

  return stringHTML;
}

function processInlineElements () {
  stringHTML = processAllInLineElements(stringHTML);
  stringHTML = processAllImageElements(stringHTML);
  stringHTML = isBoldItalicOrBothInline(stringHTML);
  stringHTML = isInlineCode(stringHTML);
  stringHTML = isTable(stringHTML);
}

function processStartOfLineElements() {
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
      isParagraph(line);
      break;
    case 'quote' : 
      stringHTML = stringHTML.concat(isQuote(line));
      break;
    case 'list' : 
      isUnOrderedList(line);
      break;
    case 'tableRow' : 
      // if(line[1] === ':' || line[1] === '' || line[1] === '-')
      stringHTML = stringHTML.concat(isTableRow(line));
      break;
    default :
      if(!isNaN(parseInt(line[0])) && line[1] === '.') {
        isOrderedList(line);
        break;
      }
      isParagraph(line);
      break;
  }
  return true;
}

function isParagraph(line) {
  line = `<p>${line}</p>\n`;
  stringHTML = stringHTML.concat(line);
}

function isTableRow(line) {
  let rowElements = [];
  let prevousMatch;
  let matches = matchAllRegex(line, regexJSON['tableElement']);
  for(let match of matches) {
    if(!prevousMatch) {
      prevousMatch = match;
      continue;
    }
    rowElements.push(line.slice(prevousMatch.index+1, match.index-1).trim());
    prevousMatch = match;
  }
  let returnline = '<tr>'
  rowElements.forEach(elem => returnline = returnline.concat(`\n\t<td>${elem}</td>`));
  returnline = returnline.concat('\n</tr>\n');
  return returnline;
}

function isTable(string) {
  //remove table division
  let matchTableDivison = matchRegex(string, regexJSON['tableDivision']);
  while(matchTableDivison) {
    string = string.slice(0, matchTableDivison.index) 
    + string.slice(matchTableDivison[0].length + matchTableDivison.index);

    matchTableDivison = matchRegex(string, regexJSON['tableDivision']);
  }

  let allTableRows = [...matchAllRegex(string, regexJSON['tableRow'])];
  let tables = [];
  let tableStartAndEndIndex = [];
  let table = '';
  let tableHeadAdded = false;
  allTableRows.forEach((match) => {
    let start = match.index;
    let end = match.index + match[0].length;
    //is Heading < \n <
    if(
      string[start]==='<' &&
      (string[end] === '\n' || string[end] === undefined) && //if the table is the last element of the file
      (string[end+1] === '<' || string[end+1] === undefined) //the values will be undefined
      ) {
      if(tableHeadAdded) {
        table = table.concat(string.slice(start, end));
        table = table.concat('</table>');
        tables.push(table);
        table = '';
        tableHeadAdded = false;
        tableStartAndEndIndex.push(end);
      }
      else {
        table = string.slice(start, end+1);
        table = `<table>\n${table}`;
        table = table.replace(new RegExp('<td>', 'gm'), '<th>');
        table = table.replace(new RegExp('</td>', 'gm'), '</th>');
        tableHeadAdded = true;
        tableStartAndEndIndex.push(start);
      }
    }
    //< < t is body of table
    else if(string[start] === '<' && string[end] === '<' && string[end+1] === 't') {
      table = table.concat(string.slice(start, end));
    }
  });

  // string = string.slice(tableStartAndEndIndex[1]);
  for(let i = 0; i < tables.length; i++) {
    //<table>\n</table> add total of 16 chars for each table.
    let start = tableStartAndEndIndex[i*2] + 16*i;
    let end = tableStartAndEndIndex[i*2 + 1] + 16*i;
    console.log(i, start, end);

    let beforeTable = string.slice(0, start);
    let afterTable = string.slice(end);
    string = beforeTable + tables[i] + afterTable;

    console.log('before' , beforeTable);
    console.log('after' , afterTable);
  }
  console.log(tables);
  console.log(tableStartAndEndIndex);
  return string;
}

function processAllInLineElements(string) {
  let match = matchRegex(string, regexJSON['link']);
  while(match) {
    //Regex of link will check so that there is no ! at start, so that it is not image
    //So we want prevent the first charcter of match from being sliced, hence `+1`
    string = string.slice(0, match.index+1) 
    + `<a href="${match.groups.linkSrc}">${match.groups.linkName}</a>` 
    + string.slice(match.index+match[0].length);
    match = matchRegex(string, regexJSON['link']);
  }
  return string;
}

function processAllImageElements(string) {
  let match = matchRegex(string, regexJSON['picture']);
  while(match) {
    string = string.slice(0, match.index) 
    + `<img src="${match.groups.imageSrc}" alt="${match.groups.imageAltText}"/>` 
    + string.slice(match.index+match[0].length);
    match = matchRegex(string, regexJSON['picture']);
  }
  return string;
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

//Is decorated(bold, em, both) inline
function isBoldItalicOrBothInline(string) {
  //first find all bold and italic both
  let match = matchRegex(string, regexJSON['bold-em']);
  while(match) {
    string = string.slice(0, match.index) 
    + `<strong><em>${match.groups.boldEmContent} </em></strong>` 
    + string.slice(match.index+match[0].length);
    match = matchRegex(string, regexJSON['bold-em']);
  }

  //second find all bold
  match = matchRegex(string, regexJSON['bold']);
  while(match) {
    string = string.slice(0, match.index) 
    + `<strong>${match.groups.boldContent}</strong>` 
    + string.slice(match.index+match[0].length);
    match = matchRegex(string, regexJSON['bold']);
  }

  //last for em
  match = matchRegex(string, regexJSON['em']);
  while(match) {
    string = string.slice(0, match.index) 
    + `<em>${match.groups.emContent}</em>` 
    + string.slice(match.index+match[0].length);
    match = matchRegex(string, regexJSON['em']);
  }
  return string;
}

function isInlineCode(string) {
  let match = matchRegex(string, regexJSON['inlineCode']);
  while(match) {
    string = string.slice(0, match.index) 
    + `<samp>${match.groups.codeString}</samp>` 
    + string.slice(match.index+match[0].length);
    match = matchRegex(string, regexJSON['inlineCode']);
  }
  return string;
}

function isUnOrderedList(line) {
  if(line[1] !== ' ') {
    // isBoldItalicOrBoth(line);
    isParagraph(line);
    return;
  }
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
  let regexp = new RegExp(regexJson.regex, regexJson.flags);
  return string.matchAll(regexp);
}

function matchRegex(string, regexJson) {
  let regexp =new RegExp(regexJson.regex, regexJson.flags);
  return string.match(regexp);
}

function clearOutPut() {
  stringHTML = '';
}

fromTextButton.onclick= ()=> {
  clearOutPut();
  let text = textInput.value;
  load(undefined, text).then(result => {
    resultText.value = result
    iframeResultPage.contentWindow.document.body.innerHTML = result;
  });
}

fromLinkButton.onclick= ()=> {
  clearOutPut();
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