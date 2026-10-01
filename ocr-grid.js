/* ============================================================
   OCR TABLE PARSER — Table-aware timetable importer
   - OCR with word coordinates (not plain text only)
   - Detects weekday columns + time rows
   - Matches OCR text against COURSES_DB / current courses
   - Imports matched courses into "موادي" and sessions into timetable
   ============================================================ */
(function(){
  'use strict';

  var OCR = {
    raw: null,
    image: null,
    busy: false
  };

  var DAY_ALIASES = {
    Sun: ['sun','sunday','الأحد','الاحد','حد'],
    Mon: ['mon','monday','الاثنين','الإثنين','اثنين'],
    Tue: ['tue','tues','tuesday','الثلاثاء','ثلاثاء'],
    Wed: ['wed','wednesday','الأربعاء','الاربعاء','أربعاء'],
    Thu: ['thu','thur','thurs','thursday','الخميس','خميس'],
    Fri: ['fri','friday','الجمعة','جمعه','جمعة'],
    Sat: ['sat','saturday','السبت','سبت']
  };

  var DAY_ORDER = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  function notify(msg, type, ms){
    try {
      if(typeof toast === 'function'){
        toast(msg, type || 'info', ms || 2500);
      }
    } catch(e){}
  }

  function safeText(v){
    return String(v == null ? '' : v)
      .replace(/\s+/g, ' ')
      .trim();
  }

  function arabicDigits(s){
    return safeText(s)
      .replace(/[٠-٩]/g, function(c){
        return String('٠١٢٣٤٥٦٧٨٩'.indexOf(c));
      })
      .replace(/[۰-۹]/g, function(c){
        return String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c));
      });
  }

  function normalize(s){
    return arabicDigits(String(s || ''))
      .toLowerCase()
      .replace(/[\u064B-\u065F\u0670]/g,'')
      .replace(/[أإآ]/g,'ا')
      .replace(/ى/g,'ي')
      .replace(/ؤ/g,'و')
      .replace(/ئ/g,'ي')
      .replace(/ة/g,'ه')
      .replace(/ـ/g,'')
      .replace(/[^\u0600-\u06FFa-z0-9]+/gi,' ')
      .replace(/\s+/g,' ')
      .trim();
  }

  function tokenize(s){
    var n = normalize(s);
    return n
      ? n.split(' ').filter(function(x){
          return x.length > 1;
        })
      : [];
  }

  function levenshtein(a,b){
    a = String(a || '');
    b = String(b || '');

    if(a === b) return 0;
    if(!a) return b.length;
    if(!b) return a.length;

    var prev = [];
    var cur = [];
    var i, j;

    for(j=0;j<=b.length;j++){
      prev[j] = j;
    }

    for(i=1;i<=a.length;i++){
      cur[0] = i;

      for(j=1;j<=b.length;j++){
        var cost =
          a.charAt(i-1) === b.charAt(j-1) ? 0 : 1;

        cur[j] = Math.min(
          cur[j-1] + 1,
          prev[j] + 1,
          prev[j-1] + cost
        );
      }

      var tmp = prev;
      prev = cur;
      cur = tmp;
    }

    return prev[b.length];
  }

  function similarity(a,b){
    a = normalize(a);
    b = normalize(b);

    if(!a || !b) return 0;
    if(a === b) return 1;

    if(a.indexOf(b) !== -1 || b.indexOf(a) !== -1){
      return Math.min(
        0.98,
        0.78 +
        Math.min(a.length,b.length) /
        Math.max(a.length,b.length) *
        0.2
      );
    }

    var ta = tokenize(a);
    var tb = tokenize(b);
    var setB = {};

    tb.forEach(function(x){
      setB[x] = true;
    });

    var inter = 0;

    ta.forEach(function(x){
      if(setB[x]) inter++;
    });

    var union = {};

    ta.concat(tb).forEach(function(x){
      union[x] = true;
    });

    var unionKeys = Object.keys(union);

    var jaccard =
      unionKeys.length
        ? inter / unionKeys.length
        : 0;

    var maxLen = Math.max(a.length,b.length);

    var lev =
      maxLen
        ? 1 - levenshtein(a,b) / maxLen
        : 0;

    return Math.max(
      jaccard * 0.78 + lev * 0.22,
      lev * 0.82
    );
  }

  function allCourseCandidates(){
    var map = {};
    var out = [];

    function add(name, data){
      name = safeText(name);

      if(!name) return;

      var key = normalize(name);

      if(map[key]) return;

      map[key] = true;

      out.push({
        name:name,
        code:data && data.code
          ? String(data.code)
          : '',
        hours:
          data &&
          (data.h != null
            ? data.h
            : data.hours) != null
            ? parseInt(
                data.h != null
                  ? data.h
                  : data.hours,
                10
              ) || 3
            : 3
      });
    }

    try {
      if(Array.isArray(space && space.courses)){
        space.courses.forEach(function(c){
          add(c.name, c);
        });
      }
    } catch(e){}

    try {
      if(typeof COURSES_DB === 'object' && COURSES_DB){
        Object.keys(COURSES_DB).forEach(function(k){
          add(k, COURSES_DB[k]);
        });
      }
    } catch(e){}

    try {
      if(Array.isArray(SEMESTERS)){
        SEMESTERS.forEach(function(s){
          (s.courses || []).forEach(function(c){
            add(c.n, c);
          });
        });
      }
    } catch(e){}

    return out;
  }

  function bestCourseMatch(text){
    var raw = safeText(text);

    if(!raw) return null;

    var candidates = allCourseCandidates();
    var best = null;

    candidates.forEach(function(c){
      var score = similarity(raw, c.name);

      var rn = normalize(raw);
      var cn = normalize(c.name);

      if(rn.indexOf(cn) !== -1){
        score = Math.max(score, 0.92);
      }

      if(!best || score > best.score){
        best = {
          course:c,
          score:score
        };
      }
    });

    if(best && best.score >= 0.58){
      return best;
    }

    return {
      course:{
        name:raw,
        code:'',
        hours:3
      },
      score:0
    };
  }

  function parseTime(text){
    var s = arabicDigits(text)
      .replace(/[٫，]/g, ':')
      .replace(/\s/g,'');

    var m = s.match(
      /(?:^|[^0-9])([01]?\d|2[0-3])\s*(?::|\.)\s*([0-5]\d)(?:\s*(?:AM|PM|ص|م))?/i
    );

    if(!m){
      var m2 = s.match(/\b([01]?\d|2[0-3])\s+([0-5]\d)\b/);

      if(m2){
        return (
          String(parseInt(m2[1],10)).padStart(2,'0') +
          ':' +
          m2[2]
        );
      }

      var m3 = s.match(/\b([01]?\d|2[0-3])([0-5]\d)\b/);

      if(m3){
        return (
          String(parseInt(m3[1],10)).padStart(2,'0') +
          ':' +
          m3[2]
        );
      }

      return null;
    }

    var hh = parseInt(m[1],10);
    var mm = m[2];

    var ampm = m[0]
      .slice(-2)
      .toLowerCase();

    if(/pm|م/.test(ampm) && hh < 12){
      hh += 12;
    }

    if(/am|ص/.test(ampm) && hh === 12){
      hh = 0;
    }

    return (
      String(hh).padStart(2,'0') +
      ':' +
      mm
    );
  }

  function findTimeInText(text){
    var normalized = arabicDigits(text);

    var range = normalized.match(
      /(\d{1,2}\s*[:.]\s*\d{2})\s*[-–—]\s*(\d{1,2}\s*[:.]\s*\d{2})/
    );

    if(range){
      return parseTime(range[1]);
    }

    return parseTime(normalized);
  }

  function detectDay(text){
    var n = normalize(text);

    if(!n) return null;

    for(var i=0;i<DAY_ORDER.length;i++){
      var day = DAY_ORDER[i];
      var aliases = DAY_ALIASES[day];

      for(var j=0;j<aliases.length;j++){
        var a = normalize(aliases[j]);

        if(
          a &&
          (
            n === a ||
            n.indexOf(a) !== -1
          )
        ){
          return day;
        }
      }
    }

    return null;
  }

  function imageToDataURL(file){
    return new Promise(function(resolve,reject){
      var fr = new FileReader();

      fr.onload = function(){
        resolve(fr.result);
      };

      fr.onerror = reject;

      fr.readAsDataURL(file);
    });
  }

  function preprocess(dataURL){
    return new Promise(function(resolve,reject){
      var img = new Image();

      img.onload = function(){
        var maxSide = 2600;

        var scale = Math.min(
          3,
          maxSide /
          Math.max(
            img.naturalWidth,
            img.naturalHeight
          )
        );

        if(!isFinite(scale) || scale < 1){
          scale = 1;
        }

        var w = Math.max(
          1,
          Math.round(img.naturalWidth * scale)
        );

        var h = Math.max(
          1,
          Math.round(img.naturalHeight * scale)
        );

        var canvas =
          document.createElement('canvas');

        canvas.width = w;
        canvas.height = h;

        var ctx =
          canvas.getContext(
            '2d',
            {
              willReadFrequently:true
            }
          );

        ctx.drawImage(
          img,
          0,
          0,
          w,
          h
        );

        var im =
          ctx.getImageData(
            0,
            0,
            w,
            h
          );

        var d = im.data;

        for(var i=0;i<d.length;i+=4){
          var y =
            (
              0.299*d[i] +
              0.587*d[i+1] +
              0.114*d[i+2]
            );

          y = Math.max(
            0,
            Math.min(
              255,
              (y - 128) * 1.35 + 128
            )
          );

          d[i] =
            d[i+1] =
            d[i+2] =
            y;
        }

        ctx.putImageData(im,0,0);

        resolve({
          dataURL:
            canvas.toDataURL('image/png'),
          width:w,
          height:h
        });
      };

      img.onerror = reject;

      img.src = dataURL;
    });
  }

  function setProgress(pct,msg){
    var p =
      document.getElementById(
        'ocrProgress'
      );

    var b =
      document.getElementById(
        'ocrBar'
      );

    var t =
      document.getElementById(
        'ocrText'
      );

    if(p){
      p.style.display='block';
    }

    if(b){
      b.style.width =
        Math.max(
          0,
          Math.min(
            100,
            pct || 0
          )
        ) + '%';
    }

    if(t && msg){
      t.textContent = msg;
    }
  }

  function showPreview(dataURL){
    var p =
      document.getElementById(
        'ocrPreview'
      );

    if(!p) return;

    p.style.display='block';

    p.innerHTML =
      '<img src="' +
      dataURL +
      '" alt="OCR preview">';
  }

  function groupWordsIntoLines(words){
    var clean = words
      .filter(function(w){
        var txt = safeText(w.text);

        var conf =
          w.confidence == null
            ? 100
            : parseFloat(
                w.confidence
              );

        return (
          txt &&
          conf >= 25 &&
          w.bbox
        );
      })
      .map(function(w){
        return {
          text:safeText(w.text),
          confidence:
            parseFloat(
              w.confidence || 0
            ),
          x:
            (
              w.bbox.x0 +
              w.bbox.x1
            ) / 2,
          y:
            (
              w.bbox.y0 +
              w.bbox.y1
            ) / 2,
          w:
            Math.max(
              1,
              w.bbox.x1 -
              w.bbox.x0
            ),
          h:
            Math.max(
              1,
              w.bbox.y1 -
              w.bbox.y0
            ),
          x0:w.bbox.x0,
          x1:w.bbox.x1,
          y0:w.bbox.y0,
          y1:w.bbox.y1
        };
      })
      .sort(function(a,b){
        return a.y-b.y || a.x-b.x;
      });

    var lines=[];

    clean.forEach(function(word){
      var best=null;
      var bestDy=Infinity;

      lines.forEach(function(line){
        var dy =
          Math.abs(
            word.y -
            line.y
          );

        var lim =
          Math.max(
            10,
            Math.max(
              word.h,
              line.h
            ) * 0.65
          );

        if(
          dy <= lim &&
          dy < bestDy
        ){
          best=line;
          bestDy=dy;
        }
      });

      if(!best){
        best={
          y:word.y,
          words:[]
        };

        lines.push(best);
      }

      best.words.push(word);

      best.y =
        best.words.reduce(
          function(s,x){
            return s+x.y;
          },
          0
        ) /
        best.words.length;
    });

    lines.forEach(function(line){
      line.words.sort(function(a,b){
        return a.x-b.x;
      });

      line.text =
        safeText(
          line.words
            .map(function(w){
              return w.text;
            })
            .join(' ')
        );

      line.x0 =
        Math.min.apply(
          null,
          line.words.map(
            function(w){
              return w.x0;
            }
          )
        );

      line.x1 =
        Math.max.apply(
          null,
          line.words.map(
            function(w){
              return w.x1;
            }
          )
        );
    });

    lines.sort(function(a,b){
      return a.y-b.y;
    });

    return lines;
  }

  function detectHeaders(lines, imageWidth){
    var found=[];

    lines.forEach(function(line){
      var day=null;

      line.words.forEach(function(w){
        var d=detectDay(w.text);

        if(d){
          day=d;
        }
      });

      if(!day){
        day=detectDay(line.text);
      }

      if(day){
        found.push({
          day:day,
          x:
            (
              line.x0 +
              line.x1
            ) / 2,
          y:line.y,
          text:line.text
        });
      }
    });

    var byDay={};

    found.forEach(function(x){
      if(
        !byDay[x.day] ||
        x.y < byDay[x.day].y
      ){
        byDay[x.day]=x;
      }
    });

    found =
      DAY_ORDER
        .filter(function(d){
          return !!byDay[d];
        })
        .map(function(d){
          return byDay[d];
        });

    if(found.length < 3 && lines.length){
      var firstLines =
        lines.slice(
          0,
          Math.min(4,lines.length)
        );

      var candidates=[];

      firstLines.forEach(function(line){
        line.words.forEach(function(w){
          if(
            !findTimeInText(w.text) &&
            w.text.length >= 2
          ){
            candidates.push(w);
          }
        });
      });

      var clusters=[];

      candidates.forEach(function(w){
        var c =
          clusters.find(function(c){
            return (
              Math.abs(
                c.x-w.x
              ) <
              Math.max(
                35,
                w.w*2
              )
            );
          });

        if(!c){
          c={
            x:w.x,
            words:[]
          };

          clusters.push(c);
        }

        c.words.push(w);

        c.x =
          c.words.reduce(
            function(s,z){
              return s+z.x;
            },
            0
          ) /
          c.words.length;
      });

      clusters.sort(function(a,b){
        return a.x-b.x;
      });

      if(clusters.length >= 3){
        var chosen =
          clusters.slice(
            0,
            Math.min(7,clusters.length)
          );

        found =
          chosen
            .map(function(c,idx){
              return {
                day:
                  DAY_ORDER[idx] ||
                  null,
                x:c.x,
                y:c.words[0].y,
                text:
                  c.words
                    .map(function(w){
                      return w.text;
                    })
                    .join(' ')
              };
            })
            .filter(function(x){
              return !!x.day;
            });
      }
    }

    if(found.length < 3){
      var left =
        imageWidth * 0.13;

      var width =
        (imageWidth-left) / 5;

      found =
        ['Sun','Mon','Tue','Wed','Thu']
          .map(function(day,i){
            return {
              day:day,
              x:
                left +
                width *
                (i+0.5),
              y:0,
              text:day,
              synthetic:true
            };
          });
    }

    return found;
  }

  function makeColumnBounds(headers, imageWidth){
    headers =
      headers
        .slice()
        .sort(function(a,b){
          return a.x-b.x;
        });

    var bounds=[];

    for(var i=0;i<headers.length;i++){
      var left =
        i===0
          ? Math.max(
              0,
              (
                headers[i].x +
                (
                  headers[i].x -
                  80
                )
              ) / 2
            )
          : (
              headers[i-1].x +
              headers[i].x
            ) / 2;

      var right =
        i===headers.length-1
          ? Math.min(
              imageWidth,
              headers[i].x +
              Math.max(
                80,
                headers[i].x -
                headers[i-1].x
              )
            )
          : (
              headers[i].x +
              headers[i+1].x
            ) / 2;

      bounds.push({
        day:headers[i].day,
        left:left,
        right:right,
        x:headers[i].x
      });
    }

    return bounds;
  }

  function wordColumn(x,bounds){
    for(var i=0;i<bounds.length;i++){
      if(
        x>=bounds[i].left &&
        x<bounds[i].right
      ){
        return i;
      }
    }

    var best=0;
    var bestD=Infinity;

    bounds.forEach(function(b,i){
      var d =
        Math.abs(
          x-b.x
        );

      if(d<bestD){
        bestD=d;
        best=i;
      }
    });

    return best;
  }

  function extractRows(lines, headers, imageHeight){
    var timeAnchors=[];

    lines.forEach(function(line){
      var tm =
        findTimeInText(
          line.text
        );

      if(tm){
        timeAnchors.push({
          time:tm,
          y:line.y,
          text:line.text
        });
      }
    });

    var unique={};

    timeAnchors.forEach(function(a){
      var key =
        a.time +
        '|' +
        Math.round(
          a.y / 10
        );

      if(!unique[key]){
        unique[key]=a;
      }
    });

    timeAnchors =
      Object.keys(unique)
        .map(function(k){
          return unique[k];
        })
        .sort(function(a,b){
          return a.y-b.y;
        });

    if(!timeAnchors.length){
      var ys=[];

      lines.forEach(function(line){
        if(
          line.y >
          imageHeight * 0.10
        ){
          ys.push(line.y);
        }
      });

      ys.sort(function(a,b){
        return a-b;
      });

      var clusters=[];

      ys.forEach(function(y){
        var c =
          clusters.length
            ? clusters[
                clusters.length-1
              ]
            : null;

        if(
          !c ||
          Math.abs(y-c.y)>28
        ){
          c={y:y};
          clusters.push(c);
        }else{
          c.y =
            (c.y+y)/2;
        }
      });

      var fallbackTimes =
        window.TIME_SLOTS ||
        [
          '08:00',
          '08:30',
          '09:00',
          '09:30',
          '10:00',
          '10:30',
          '11:00',
          '11:30',
          '12:00',
          '12:30',
          '13:00'
        ];

      clusters
        .slice(
          0,
          Math.min(
            fallbackTimes.length,
            24
          )
        )
        .forEach(function(c,i){
          timeAnchors.push({
            time:fallbackTimes[i],
            y:c.y,
            text:fallbackTimes[i],
            synthetic:true
          });
        });
    }

    return timeAnchors.sort(function(a,b){
      return a.y-b.y;
    });
  }

  function rowIndexForY(y,anchors){
    if(!anchors.length) return -1;

    if(
      y <
      (
        anchors[0].y +
        0
      ) / 2
    ){
      return -1;
    }

    var best=0;
    var bestD =
      Math.abs(
        y -
        anchors[0].y
      );

    for(var i=1;i<anchors.length;i++){
      var d =
        Math.abs(
          y -
          anchors[i].y
        );

      if(d<bestD){
        best=i;
        bestD=d;
      }
    }

    return best;
  }

  function buildStructuredCells(data){
    var words =
      (data && data.words) ||
      [];

    var imageWidth =
      (data && data.imageWidth) ||
      2000;

    var imageHeight =
      (data && data.imageHeight) ||
      1200;

    var lines =
      groupWordsIntoLines(
        words
      );

    var headers =
      detectHeaders(
        lines,
        imageWidth
      );

    var bounds =
      makeColumnBounds(
        headers,
        imageWidth
      );

    var rows =
      extractRows(
        lines,
        headers,
        imageHeight
      );

    var cells={};

    function getCell(r,c){
      var key =
        r+'|'+c;

      if(!cells[key]){
        cells[key]={
          row:r,
          col:c,
          words:[]
        };
      }

      return cells[key];
    }

    words.forEach(function(w0){
      var text =
        safeText(
          w0.text
        );

      if(
        !text ||
        !w0.bbox
      ){
        return;
      }

      var w={
        text:text,
        confidence:
          parseFloat(
            w0.confidence || 0
          ),
        x:
          (
            w0.bbox.x0 +
            w0.bbox.x1
          ) / 2,
        y:
          (
            w0.bbox.y0 +
            w0.bbox.y1
          ) / 2
      };

      if(detectDay(text)){
        return;
      }

      if(findTimeInText(text)){
        return;
      }

      var r =
        rowIndexForY(
          w.y,
          rows
        );

      if(r<0){
        return;
      }

      var c =
        wordColumn(
          w.x,
          bounds
        );

      if(c>=0){
        getCell(
          r,
          c
        ).words.push(w);
      }
    });

    var out=[];

    Object.keys(cells).forEach(function(k){
      var c=cells[k];

      c.words.sort(function(a,b){
        return a.y-b.y || a.x-b.x;
      });

      var txt =
        safeText(
          c.words
            .map(function(w){
              return w.text;
            })
            .join(' ')
        );

      if(!txt){
        return;
      }

      var match =
        bestCourseMatch(
          txt
        );

      var conf =
        c.words.reduce(
          function(s,w){
            return (
              s +
              (
                isFinite(
                  w.confidence
                )
                  ? w.confidence
                  : 0
              )
            );
          },
          0
        ) /
        (
          c.words.length ||
          1
        );

      out.push({
        day:
          bounds[c.col]
            ? bounds[c.col].day
            : DAY_ORDER[c.col],

        time:
          rows[c.row]
            ? rows[c.row].time
            : '',

        raw:txt,

        confidence:conf,

        match:match
      });
    });

    out =
      out.filter(function(x){
        if(
          !x.day ||
          !x.time ||
          !x.raw
        ){
          return false;
        }

        if(
          detectDay(x.raw) &&
          x.raw.length<25
        ){
          return false;
        }

        return true;
      });

    var merged={};

    out.forEach(function(x){
      var key =
        x.day +
        '-' +
        x.time;

      if(
        !merged[key] ||
        x.confidence >
        merged[key].confidence
      ){
        merged[key]=x;
      }
    });

    return {
      cells:
        Object.keys(merged)
          .map(function(k){
            return merged[k];
          }),

      headers:headers,
      rows:rows,
      lines:lines
    };
  }

  function cleanRoom(text){
    var s =
      safeText(text);

    var m =
      s.match(
        /(?:قاعة|غرفة|room|hall|lab|مختبر)\s*[:#-]?\s*([A-Za-z\u0600-\u06FF]?\s*\d{1,4})/i
      );

    if(m){
      return safeText(m[1]);
    }

    var nums =
      s.match(
        /\b(?:[A-Za-z]\s*)?\d{2,4}\b/
      );

    return nums
      ? nums[0].replace(/\s+/g,'')
      : '';
  }

  function importIntoSite(result){
    if(
      !result ||
      !result.cells ||
      !result.cells.length
    ){
      notify(
        'ما قدرت أتعرف على محاضرات من الصورة — جرّب صورة أوضح',
        'warn',
        4000
      );

      return {
        courses:0,
        classes:0
      };
    }

    if(!space){
      notify(
        'بيانات الموقع لم تجهز بعد',
        'warn'
      );

      return {
        courses:0,
        classes:0
      };
    }

    if(
      !Array.isArray(
        space.courses
      )
    ){
      space.courses=[];
    }

    if(
      !space.timetable ||
      typeof space.timetable!=='object'
    ){
      space.timetable={};
    }

    var courseAdded=0;
    var classAdded=0;

    result.cells.forEach(function(cell){
      var match =
        cell.match &&
        cell.match.course
          ? cell.match
          : bestCourseMatch(
              cell.raw
            );

      var course =
        match.course ||
        {
          name:cell.raw,
          code:'',
          hours:3
        };

      var canonical =
        course.name ||
        cell.raw;

      var room =
        cleanRoom(
          cell.raw
        );

      var existing =
        space.courses.find(function(c){
          return (
            normalize(c.name) ===
            normalize(canonical)
          ) ||
          (
            course.code &&
            c.code &&
            String(c.code) ===
            String(course.code)
          );
        });

      if(!existing){
        existing={
          id:
            (
              typeof uid === 'function'
                ? uid()
                : (
                    'ocr-' +
                    Date.now() +
                    '-' +
                    Math.random()
                      .toString(36)
                      .slice(2)
                  )
            ),

          name:canonical,

          code:
            course.code || '',

          hours:
            parseInt(
              course.hours,
              10
            ) || 3,

          instructor:'',

          room:
            room || ''
        };

        space.courses.push(
          existing
        );

        courseAdded++;

      }else if(
        room &&
        !existing.room
      ){
        existing.room=room;
      }

      var key =
        cell.day +
        '-' +
        cell.time;

      if(
        space.timetable[key] &&
        normalize(
          space.timetable[key].name
        ) !==
        normalize(canonical)
      ){
        /*
         * لا تستبدل محاضرة موجودة
         * حتى لا نخرب جدول المستخدم.
         */
      }else{
        space.timetable[key]={
          name:canonical,

          room:
            room ||
            existing.room ||
            '',

          instructor:
            existing.instructor ||
            ''
        };

        classAdded++;
      }
    });

    try{
      if(
        typeof saveSpace ===
        'function'
      ){
        saveSpace();
      }

      if(
        typeof renderCourses ===
        'function'
      ){
        renderCourses();
      }

      if(
        typeof renderTimetable ===
        'function'
      ){
        renderTimetable();
      }

      if(
        typeof renderDashboard ===
        'function'
      ){
        renderDashboard();
      }

    }catch(e){
      console.error(
        'OCR render',
        e
      );
    }

    notify(
      '✅ أضيفت ' +
      courseAdded +
      ' مادة و ' +
      classAdded +
      ' محاضرة',

      'success',

      3500
    );

    return {
      courses:courseAdded,
      classes:classAdded
    };
  }

  function parseTextFallback(text){
    var lines =
      String(text || '')
        .split(/\r?\n/)
        .map(function(s){
          return safeText(s);
        })
        .filter(Boolean);

    var cells=[];

    lines.forEach(function(line){
      var day =
        detectDay(line);

      var time =
        findTimeInText(line);

      if(
        !day ||
        !time
      ){
        return;
      }

      var aliases =
        DAY_ALIASES[day] ||
        [];

      var dayPattern =
        aliases
          .map(function(a){
            return a.replace(
              /[.*+?^${}()|[\]\\]/g,
              '\\$&'
            );
          })
          .join('|');

      var name =
        line
          .replace(
            new RegExp(
              dayPattern,
              'ig'
            ),
            ' '
          )
          .replace(
            /\d{1,2}\s*[:.]\s*\d{2}(?:\s*[-–—]\s*\d{1,2}\s*[:.]\s*\d{2})?/g,
            ' '
          )
          .replace(
            /\s+/g,
            ' '
          )
          .trim();

      if(name){
        cells.push({
          day:day,
          time:time,
          raw:name,
          confidence:80,
          match:
            bestCourseMatch(
              name
            )
        });
      }
    });

    return {
      cells:cells,
      headers:[],
      rows:[],
      lines:[]
    };
  }

  async function analyze(file){
    if(OCR.busy){
      return;
    }

    OCR.busy=true;

    try{
      if(
        !file ||
        !/^image\//i.test(
          file.type
        )
      ){
        notify(
          'ارفع صورة PNG أو JPG',
          'warn'
        );

        return;
      }

      clearOcrLocal();

      setProgress(
        5,
        'جاري تجهيز الصورة...'
      );

      var original =
        await imageToDataURL(
          file
        );

      showPreview(
        original
      );

      setProgress(
        15,
        'جاري تحسين الصورة...'
      );

      var prep =
        await preprocess(
          original
        );

      OCR.image=prep;

      if(
        typeof Tesseract ===
        'undefined'
      ){
        if(
          typeof loadTesseract ===
          'function'
        ){
          await loadTesseract();
        }else{
          throw new Error(
            'Tesseract غير محمّل'
          );
        }
      }

      setProgress(
        22,
        'جاري قراءة الجدول...'
      );

      var result =
        await Tesseract.recognize(
          prep.dataURL,
          'eng+ara',
          {
            logger:function(m){
              if(
                m &&
                m.status ===
                'recognizing text'
              ){
                var pct =
                  22 +
                  Math.round(
                    (
                      m.progress ||
                      0
                    ) * 65
                  );

                setProgress(
                  pct,
                  'جاري قراءة الجدول... ' +
                  Math.round(
                    (
                      m.progress ||
                      0
                    ) * 100
                  ) +
                  '%'
                );
              }
            },

            tessedit_pageseg_mode:'6',

            preserve_interword_spaces:'1'
          }
        );

      var data =
        result &&
        result.data
          ? result.data
          : {};

      OCR.raw=data;

      if(!data.imageWidth){
        data.imageWidth =
          prep.width;
      }

      if(!data.imageHeight){
        data.imageHeight =
          prep.height;
      }

      var words =
        data.words || [];

      if(
        !words.length &&
        data.lines
      ){
        data.lines.forEach(function(line){
          (
            line.words || []
          ).forEach(function(w){
            words.push(w);
          });
        });
      }

      data.words=words;

      var parsed =
        buildStructuredCells(
          data
        );

      OCR.parsed=parsed;

      window.__ocrTableData={
        tesseract:data,
        parsed:parsed
      };

      var resultEl =
        document.getElementById(
          'ocrResult'
        );

      var ta =
        document.getElementById(
          'ocrTextarea'
        );

      if(resultEl){
        resultEl.style.display =
          'block';
      }

      if(ta){
        ta.value =
          parsed.cells
            .map(function(x){
              return (
                x.day +
                ' | ' +
                x.time +
                ' | ' +
                x.match.course.name +
                (
                  x.raw &&
                  normalize(x.raw) !==
                  normalize(
                    x.match.course.name
                  )
                    ? '  [' +
                      x.raw +
                      ']'
                    : ''
                )
              );
            })
            .join('\n') ||
          (
            data.text ||
            ''
          ).trim();
      }

      setProgress(
        100,
        '✓ تم فهم الجدول — تم اكتشاف ' +
        parsed.cells.length +
        ' خانة'
      );

      notify(
        '✅ تم تحليل بنية الجدول',
        'success',
        2500
      );

    }catch(err){

      console.error(
        'OCR table parser error',
        err
      );

      setProgress(
        100,
        'حدث خطأ في OCR'
      );

      notify(
        'فشل تحليل الصورة: ' +
        (
          err &&
          err.message
            ? err.message
            : 'خطأ غير معروف'
        ),
        'warn',
        4500
      );

    }finally{
      OCR.busy=false;
    }
  }

  function importCurrent(){
    var p =
      window.__ocrTableData &&
      window.__ocrTableData.parsed;

    var ta =
      document.getElementById(
        'ocrTextarea'
      );

    if(
      p &&
      p.cells &&
      p.cells.length
    ){
      importIntoSite(p);
      return;
    }

    var parsed =
      parseTextFallback(
        ta
          ? ta.value
          : ''
      );

    importIntoSite(
      parsed
    );
  }

  function clearOcrLocal(){
    OCR.raw=null;
    OCR.image=null;
    OCR.parsed=null;

    window.__ocrTableData =
      null;
  }

  function bind(){
    var parseBtn =
      document.getElementById(
        'btnParseOcr'
      );

    if(
      parseBtn &&
      !parseBtn._tableBound
    ){
      parseBtn._tableBound=true;

      parseBtn.textContent =
        '🔍 تحليل واستيراد المواد + الجدول';

      parseBtn.addEventListener(
        'click',
        function(){
          importCurrent();
        }
      );
    }

    var pasteBtn =
      document.getElementById(
        'btnPasteOcr'
      );

    if(
      pasteBtn &&
      !pasteBtn._tableBound2
    ){
      pasteBtn._tableBound2=true;

      pasteBtn.addEventListener(
        'click',
        function(){
          var resultEl =
            document.getElementById(
              'ocrResult'
            );

          var ta =
            document.getElementById(
              'ocrTextarea'
            );

          if(resultEl){
            resultEl.style.display =
              'block';
          }

          if(ta){
            ta.value =
              'Sunday 08:00-09:00 Calculus 1 Room 101\n' +
              'Monday 10:00-11:00 Programming Lab1\n' +
              'Tuesday 12:00-13:00 Physics Room A';
          }
        }
      );
    }

    var clearBtn =
      document.getElementById(
        'btnClearOcr'
      );

    if(
      clearBtn &&
      !clearBtn._tableBound3
    ){
      clearBtn._tableBound3=true;

      clearBtn.addEventListener(
        'click',
        function(){
          clearOcrLocal();
        }
      );
    }
  }

  window.ocrAdvanced={
    analyze:analyze,

    parse:function(){
      return importCurrent();
    },

    parseOnly:function(){
      if(
        window.__ocrTableData &&
        window.__ocrTableData.parsed
      ){
        return
          window.__ocrTableData.parsed;
      }

      var ta =
        document.getElementById(
          'ocrTextarea'
        );

      return parseTextFallback(
        ta
          ? ta.value
          : ''
      );
    },

    importIntoSite:
      importIntoSite
  };

  if(
    document.readyState ===
    'loading'
  ){
    document.addEventListener(
      'DOMContentLoaded',
      bind
    );
  }else{
    bind();
  }

})();