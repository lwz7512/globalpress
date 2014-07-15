/**
 *
 *
 */
//for what?
var asyncForEach = function(items, fn, time) {//used in 613 loop fn
    if (!(items instanceof Array))
        return;

    var workArr = items.reverse().concat();

    // console.log(workArr.length);

    function loop() {
        if (workArr.length > 0){
            fn(workArr.shift());//reCalc()
        }
        if (workArr.length > 0){
            setTimeout(loop, time || 1);//draw each point every milisecond ?
        }
    }

    loop();
};

 var shortTimeFormat = (function() {
    var fd = d3.time.format("%d.%b.%y");
    return function(ms) {
        return fd(new Date(ms/* - TIME_ZONE*/));
    }
})();


 
 (function(vis, images) {//---- last to end of file -------
    
    var PI_CIRCLE = Math.PI * 2;

    var _worker,
        _data,
        nodes,
        dateRange,
        selected,
        selectedExt,

        colorless = d3.rgb("gray"),
        colorlessFlash = d3.rgb("lightgray"),

        parentHash,
        childHash,
        extHash,
        extMax,

        _parentKey,
        _childKey,

        _force,
        _forceBase,

        links,
        regionLinks,
        //message container, 
        lCom, lLeg, lHis,

        canvas, ctx,
        bufCanvas, bufCtx,//buffer canvas context
        layer,

        valid,
        pause,
        stop,

        particle,
        defImg,

        lastEvent,
        zoomScale,
        _w, _h,
        xW,
        yH,

        setting,
        rd3 = d3.random.irwinHall(8)
    ;

    var extColor = d3.scale.category20(),
        baseColor = d3.scale.category20b()
    ;

    var th = d3.format(",");

    var typeNode = {
        parent : 0,
        child : 1,
        region : 2
    };

    defImg = new Image();
    defImg.src = images.defImg;

    particle = new Image();
    particle.src = images.particle;

    /**
     * doing what?
     */
    function reCalc(d) {//used in asyncForEach
        // console.log(d);

        if (stop) return;

        lCom.showMessage(d.supplier.shortName + ' to ' + d.borrower.shortName + ' -> ' + d.project.name);

        var l = d.nodes.length,
                n, a, fn;

        a = d.parentNode;
        a.relations = a.relations || {};
        a.fixed = a.x instanceof Object || a.y instanceof Object ? true : false;

        if (!l)
            console.log(d);
        else {
            a.alive = setting.parentLife > 0 ? setting.parentLife : 1;
            a.opacity = 100;
            a.flash = 100;
            a.visible = true;
        }

        while(--l > -1) {
            n = d.nodes[l];

            if (n.fixed) {
                //n.x = xW(n.x);
                //n.y = yH(n.y);
                n.x = a.x;
                n.y = a.y;
                n.paths = [{x : n.x, y : n.y}];
                n.msize = n.size;
                n.size *= 3;
            }
            else {
                n.size = n.hasOwnProperty("msize") ? n.msize : n.size;
                delete n["msize"];
            }

            //n.size += 2;
            n.fixed = false;

            n.parent = a;

            n.visible = true;
            fn = _childKey(n.nodeValue);

            n.flash = 100;
            n.opacity = 100;
            n.alive = setting.childLife > 0 ? setting.childLife : 1;

            if (n.visible) {
                n.ext.now.indexOf(fn) < 0
                && n.ext.now.push(fn);
            }else {
                (fn = n.ext.now.indexOf(fn)) > -1
                && n.ext.now.splice(parseInt(fn), 1);

                n.flash *= .5;
                n.alive *= .2;
                n.opacity *= .5;
            }

            var key = a.id + "_" + n.id,
                src = a,
                trg = n,
                bid = _parentKey(n.nodeValue.borrower),
                sid = _parentKey(n.nodeValue.supplier)

            ;

            if (a.id != bid && !a.relations.hasOwnProperty(bid)) {
                a.relations[bid] = n.nodeValue.borrower;
            } else if (a.id != sid && !a.relations.hasOwnProperty(sid)) {
                a.relations[sid] = n.nodeValue.supplier;
            }

            if (n.nodeValue.borrower == a.nodeValue) {
                key = n.id + "_" + a.id;
                src = n;
                trg = a;
            }

            if (!links.has(key))
                links.set(key, {
                    key : key,
                    source : src,
                    target : trg
                });

            if (n.nodeValue.supplier == n.nodeValue.borrower) {
                key = n.id + "_" + a.id;
                if (!links.has(key))
                    links.set(key, {
                        key : key,
                        source : trg,
                        target : src
                    });
            }
        }

        updateLegend(/*d.sha*/);

        _force.nodes(nodes.filter(function(d) {
            return d.type != typeNode.parent && (d.visible || d.opacity);
        })//.sort(sortBySize)
        ).start();

        _forceBase.nodes(nodes.filter(function(d) {
            if (d.type == typeNode.region) {
                d.alive = 1;
                d.opacity = 100;
                d.flash = 100;
            }
            return (d.type == typeNode.parent || (setting.groupByRegion && d.type == typeNode.region)) && (d.visible || d.opacity);
        })).start();
    }

    /**
     * doing what?
     */
    function loop() {//used in run

        if (stop) {
            clearTimeout(_worker);
            return;
        }

        if (pause) {
            clearTimeout(_worker);
            _worker = setTimeout(loop, ONE_SECOND);
            return;
        }

        var dl, dr;

        dl = dateRange[0];
        dr = dl + stepDate;
        dateRange[0] = dr;

        appendExtLegend(shortTimeFormat(dr));//draw time in pb
        // console.log(shortTimeFormat(dr));

        var visTurn = _data.filter(function (d) {
            return d.date >= dl && d.date < dr;
        });

        // ====== this step is amazing!!! lead to cpu jump ===============
        asyncForEach(visTurn, reCalc, ONE_SECOND / (visTurn.length > 1 ? visTurn.length : ONE_SECOND));

        vis.pb.step(stepDate).label(shortTimeFormat(dr));//draw time on progress bar...

        if (dl >= dateRange[1]) {//stop running...
            updateExtHistogram();
            if (typeof _worker !== "undefined") {
                clearTimeout(_worker);
            }
            return;
        } else {
            if (!visTurn.length && setting.skipEmptyDate)
                loop();
        }

        updateExtHistogram();

        _worker = setTimeout(loop, ONE_SECOND);

        //console.log("one loop...");

    }//end of loop

    function run() {//used in runShow
        if (typeof _worker !== "undefined")
            clearTimeout(_worker);

        render();//:890

        _worker = setTimeout(loop, ONE_SECOND);

        console.log("run...");
    }

    function nr(d) {//normalize result...
        return d.size > 0 ? d.size : 0;
    }

    function curColor(d) {//used in redrawCanvas
        var ext = selectedExt;

        if (!ext && selected) {
            if (selected.type == typeNode.parent) {
                return d.nodeValue.borrower !== selected.nodeValue
                    && d.nodeValue.supplier !== selected.nodeValue
                    ? d.flash ? colorlessFlash : colorless
                    : d.flash ? d.flashColor : d.d3color;
            }
            if (selected.ext)
                ext = selected.ext;
        }

        return ext && ext.color && ext.color !== d.d3color
            ? d.flash ? colorlessFlash : colorless
            : d.flash ? d.flashColor : d.d3color;
    }

    function curOpacityParent(d) {//used in curOpacity
        if (selected && selected.type == typeNode.parent) {
            return selected != d && !selected.relations[_parentKey(d.nodeValue)]
                ? 20 : d.opacity;
        }

        return selected && selected.type == typeNode.child
            && selected.nodeValue.borrower !== d.nodeValue
            && selected.nodeValue.supplier !== d.nodeValue
            ? 20 : d.opacity;
    }

    function curOpacity(d) {//used in redrawCanvas
        if (d.type == typeNode.parent)
            return curOpacityParent(d);

        var ext = selectedExt;

        if (!ext && selected) {
            if (selected.type == typeNode.parent) {
                return d.nodeValue.borrower !== selected.nodeValue
                        && d.nodeValue.supplier !== selected.nodeValue
                        ? 20 : d.opacity;
            }
            if (selected.ext)
                ext = selected.ext;
        }

        return ext && ext.color && ext.color !== d.d3color
                ? 20 : d.opacity;
    }

    function randomTrue() {
        return Math.floor(rd3() * 8) % 2;
    }

    function radius(d) {
        return Math.sqrt(d);
    }

    function contain(d, pos) {//used in getNodeFromPos, movem
        var px = (lastEvent.translate[0] - pos[0]) / lastEvent.scale,
            py = (lastEvent.translate[1] - pos[1]) / lastEvent.scale,
            r = Math.sqrt( Math.pow( d.x + px , 2) +
                    Math.pow( d.y + py , 2 ) );

        return r < (d.type == typeNode.parent ? nr(d) * 1.5 : radius(nr(d)));
    }

    function getNodeFromPos(pos) {//used in movem
        for (var i = nodes.length - 1; i >= 0; i--) {
            var d = nodes[i];
            if (d.visible && contain(d, pos))
                return d;
        }
        return null;
    }

    function node(d, type) {//create node object: used in getBase
        var c = type == typeNode.child ? d[cat] : baseColor(d.key),
            ext, x, y,
            w2 = _w/2,
            w5 = _w/5,
            h2 = _h/2,
            h5 = _h/5
        ;
        if (type == typeNode.child) {
            ext = extHash.get(c);
            if (!ext) {
                ext = {
                    all : 0,
                    currents : {},
                    values : {},
                    color : d3.rgb(extColor(c)),
                    now : []
                };
                extHash.set(c, ext);
            }
            ext.all++;
            c = ext.color;
        }

        x = _w * Math.random();
        y = _h * Math.random();

        if (type == typeNode.parent || type == typeNode.region) {
            if (randomTrue()) {
                x = x > w5 && x < w2
                    ? x / 5
                    : x > w2 && x < _w - w5
                    ? _w - x / 5
                    : x
                ;
            }
            else {
                y = y > h5 && y < h2
                    ? y / 5
                    : y > h2 && y < _h - h5
                    ? _h - y / 5
                    : y
                ;
            }
            if (type == typeNode.parent) {
                if (d.hasOwnProperty("x")) {
                    x = d.x;
                }
                if (d.hasOwnProperty("y")) {
                    y = d.y;
                }
            }
        }

        return {
            x : x,
            y : y,
            id : type + (type == typeNode.child ? _childKey(d) : type == typeNode.region ? d : _parentKey(d)),
            size : type != typeNode.child ? type == typeNode.parent ? setting.sizeParent : 50 : d.size || 2,
            weight : type != typeNode.child ? 24 : d.size || 2,
            fixed : true,
            visible : type == typeNode.region,
            links : 0,
            type : type,
            color : c.toString(),
            d3color : c,
            flashColor: type == typeNode.child ? c.brighter().brighter() : c,
            ext : ext,
            parent : type == typeNode.parent ? d.key : null,
            img : type == typeNode.parent ? d.img : null,
            nodeValue : d
        }
    }//end of node()

    function getBase(d) {//used in initNodes
        if (!d || !d.parent)
            return null;

        var pkey = _parentKey(d.parent);

        var n = parentHash.get(pkey);

        if (!n) {
            n = node(d.parent, typeNode.parent);
            parentHash.set(pkey, n);
        }
        return n;
    }

    function getChild(d) {//used in initNodes
        if (!d)
            return null;

        var key = _childKey(d);

        var n = childHash.get(key);

        if (!n) {
            n = node(d, typeNode.child);
            n.links = 1;
            childHash.set(key, n);
        }
        return n;
    }

    function initNodes(data) {//used in runShow
        var ns = [],
                i, j, n, d, df;
        parentHash = d3.map({});
        childHash = d3.map({});
        extHash = d3.map({});
        extMax = 0;

        if (data) {
            i = data.length;
            while(--i > -1) {
                d = data[i];
                if (!d) continue;
                d.nodes = [];

                n = getBase(d);
                d.parentNode = n;
                !n.inserted && (n.inserted = ns.push(n));

                if (!d.parent.borrowed && !n.region) {
                    if (!parentHash.has("suppliers"))
                        parentHash.set("suppliers", node("suppliers", typeNode.region));
                    n.region = parentHash.get("suppliers");
                }
                else {
                    if (!parentHash.has(d.Region))
                        parentHash.set(d.Region, node(d.Region, typeNode.region));
                    n.region = parentHash.get(d.Region);
                }

                n = getChild(d);
                d.nodes.push(n);
                n.ext.currents[shortTimeFormat(d.date)] = (n.ext.currents[shortTimeFormat(d.date)] || 0);
                n.ext.currents[shortTimeFormat(d.date)]++;
                n.ext.values['_' + d.id] = +d;
                !n.inserted && (n.inserted = ns.push(n));

                j = extHash.values().reduce((function(id) { return function(a, b) {
                    return (a || 0) + (b.currents[id] || 0);
                }})(shortTimeFormat(d.date)), null);

                extMax = j > extMax ? j : extMax;
            }
        }
        return ns;
    }

    var tempFileCanvas;
    function colorize(img, r, g, b, a) {//used in redrawCanvas
        if (!img)
            return img;

        if (!tempFileCanvas)
            tempFileCanvas = document.createElement("canvas");

        if (tempFileCanvas.width != img.width)
            tempFileCanvas.width = img.width;

        if (tempFileCanvas.height != img.height)
            tempFileCanvas.height = img.height;

        var imgCtx = tempFileCanvas.getContext("2d"),
                imgData, i;
        imgCtx.drawImage(img, 0, 0);

        imgData = imgCtx.getImageData(0, 0, img.width, img.height);

        i = imgData.data.length;
        while((i -= 4) > -1) {
            imgData.data[i + 3] = imgData.data[i] * a;
            if (imgData.data[i + 3]) {
                imgData.data[i] = r;
                imgData.data[i + 1] = g;
                imgData.data[i + 2] = b;
            }
        }

        imgCtx.putImageData(imgData, 0, 0);
        return tempFileCanvas;
    }
    //do what?
    function blink(d, aliveCheck) {//used in cluster, tick
        d.flash = (d.flash -= setting.rateFlash) > 0 ? d.flash : 0;

        !d.flash && aliveCheck
        && (d.alive = (d.alive-- > 0 ? d.alive : 0))
        ;

        d.opacity = !d.alive
                ? ((d.opacity -= setting.rateOpacity) > 0 ? d.opacity : 0)
                : d.opacity
        ;

        d.visible && !d.opacity
        && (d.visible = false);

        if (d.paths) {
            d.pathLife = (d.pathLife || 0);
            if (d.pathLife++ > 0) {
                d.pathLife = 0;
                if (d.paths.length)
                    d.paths.shift();
            }
        }
    }

    function sortBySize(a, b) {//used in redrawCanvas
        return d3.ascending(a.size, b.size);
    }

    function checkVisible(d, offsetx, offsety) {//used in filterVisible
        var tx = lastEvent.translate[0]/lastEvent.scale,
                ty = lastEvent.translate[1]/lastEvent.scale
                ;

        offsetx = offsetx || 0;
        if (!(offsetx instanceof Array))
            offsetx = [offsetx, offsetx];
        offsety = offsety || 0;
        if (!(offsety instanceof Array))
            offsety = [offsety, offsety];

        return (
                d.x + d.size > -tx + offsetx[0]
                        && d.x - d.size < -tx + offsetx[1] + _w/lastEvent.scale
                        && d.y + d.size > -ty + offsety[0]
                        && d.y - d.size < -ty + offsety[1] + _h/lastEvent.scale
                );
    }

    function sortByColor(a, b) {//used in redrawCanvas
        return d3.ascending(b.color + !b.flash, a.color + !a.flash);
    }

    function sortByOpacity(a, b) {//used in redrawCanvas
        return d3.ascending(curOpacity(b), curOpacity(a));
    }

    function compereColor(a, b) {//used in redrawCanvas
        return a.r != b.r || a.g != b.g || a.b != b.b;
    }

    function filterVisible(d) {//used in redrawCanvas
        return checkVisible(d) && (d.visible || d.alive);
    }

    /**
     * doing what?
     *
     * draw tracks by links
     * 
     */
    function redrawCanvas() {//used in render():890

        bufCtx.save();
        bufCtx.clearRect(0, 0, _w, _h);

        if (setting.blendingLighter && bufCtx.globalCompositeOperation == 'source-over') {
            bufCtx.globalCompositeOperation = 'lighter';
            //darker
        }
        else if (!setting.blendingLighter && bufCtx.globalCompositeOperation == 'lighter') {
            bufCtx.globalCompositeOperation = 'source-over';
        }

        bufCtx.translate(lastEvent.translate[0], lastEvent.translate[1]);
        bufCtx.scale(lastEvent.scale, lastEvent.scale);

        var n, l, i, j,
            src, trg,
            iw, ih,
            img,
            d, beg,
            c, x, y, s;


        if (setting.showEdge || selected){
            n = links.entries();
            if (!setting.showEdge)
                n = n.filter(function(d) {
                    return d.key.indexOf(selected.id) >= 0;
                });

            l = n.length;

            bufCtx.save();
            bufCtx.lineCap="round";
            bufCtx.lineJoin="round";

            while(--l > -1) {
                d = n[l].value;
                src = d.source;
                trg = d.target;
                j = src.type == typeNode.child;

                c = curColor(j ? src : trg);

                bufCtx.beginPath();
                bufCtx.strokeStyle = c.toString();
                bufCtx.lineWidth = (radius(nr(d)) * 3)  || 1;

                var sx = j ? trg.x : src.x,
                    sy = j ? trg.y : src.y,
                    tx = !j ? trg.x : src.x,
                    ty = !j ? trg.y : src.y;

                bufCtx.moveTo(sx, sy);
                var x3 = .3 * ty - .3 * sy + .8 * sx + .2 * tx,
                    y3 = .8 * sy + .2 * ty - .3 * tx + .3 * sx,
                    x4 = .3 * ty - .3 * sy + .2 * sx + .8 * tx,
                    y4 = .2 * sy + .8 * ty - .3 * tx + .3 * sx;
                bufCtx.bezierCurveTo(x3, y3, x4, y4, tx, ty);
                bufCtx.stroke();
            }
            bufCtx.restore();
        }//end of if (setting.showEdge || selected){

        if (setting.showChild) {
            n = _force.nodes()
                    .filter(filterVisible)
                    .sort(sortBySize)
                    .sort(sortByOpacity)
                    .sort(sortByColor)
            ;

            l = n.length;

            c = null;
            i = 100;
            j = true;
            beg = false;

            bufCtx.globalAlpha = i * .01;

            while(--l > -1) {
                d = n[l];

                if (i != curOpacity(d)) {
                    i = curOpacity(d);
                    bufCtx.globalAlpha = i * .01;
                }

                if (!c || compereColor(c, curColor(d))) {
                    c = curColor(d);
                    j = false;
                }

                if (!j) {
                    if (!setting.showHalo) {
                        if (beg) {
                            bufCtx.closePath();
                            bufCtx.fill();
                            bufCtx.stroke();
                        }

                        bufCtx.beginPath();
                        beg = true;
                        bufCtx.strokeStyle = "none";
                        bufCtx.fillStyle = c.toString();
                    }
                    else
                        img = colorize(particle, c.r, c.g, c.b, 1);
                    j = true;
                }

                x = Math.floor(d.x);
                y = Math.floor(d.y);


                if (setting.fadingTail && setting.showTrack) {
                    //bufCtx.save();
                    bufCtx.lineCap="round";
                    //bufCtx.lineJoin="round";
                    bufCtx.lineWidth = (radius(nr(d)) / 4)  || 1;
                    bufCtx.fillStyle = "none";
                    bufCtx.strokeStyle = c.toString();

                    var rs = d.paths.slice(0).reverse(),
                        lrs = rs.length,
                        cura = bufCtx.globalAlpha;

                    for (var p in rs) {
                        if (!rs.hasOwnProperty(p))
                            continue;

                        bufCtx.beginPath();
                        if (p < 1)
                            bufCtx.moveTo(x, y);
                        else
                            bufCtx.moveTo(
                                Math.floor(rs[p - 1].x),
                                Math.floor(rs[p - 1].y)
                            );
                        bufCtx.lineTo(
                            Math.floor(rs[p].x),
                            Math.floor(rs[p].y)
                        );
                        bufCtx.stroke();
                        bufCtx.globalAlpha = ((lrs - p)/lrs) * cura;
                    }
                    //bufCtx.restore();
                    bufCtx.globalAlpha = cura;
                }

                if (!setting.fadingTail && setting.showTrack) {
                    bufCtx.save();
                    bufCtx.beginPath();
                    bufCtx.lineCap="round";
                    bufCtx.lineJoin="round";
                    bufCtx.strokeStyle = c.toString();
                    bufCtx.lineWidth = (radius(nr(d)) / 4)  || 1;

                    var rs = d.paths.slice(0).reverse(),
                        lrs = rs.length;

                    bufCtx.moveTo(x, y);
                    for (var p in rs) {
                        if (!rs.hasOwnProperty(p))
                            continue;

                        bufCtx.lineTo(
                                Math.floor(rs[p].x),
                                Math.floor(rs[p].y)
                        );
                    }
                    //bufCtx.closePath();
                    bufCtx.stroke();
                    bufCtx.restore();
                }

                s = radius(nr(d)) * (setting.showHalo ? 8 : 1);
                setting.showHalo
                        ? bufCtx.drawImage(img, x - s / 2, y - s / 2, s, s)
                        : bufCtx.arc(x, y, s, 0, PI_CIRCLE, true)
                ;
            }//end of while
            if (!setting.showHalo && beg) {
                bufCtx.closePath();
                bufCtx.fill();
                bufCtx.stroke();
            }
        }//end of if (setting.showChild)

        if (setting.showParent || setting.showLabel) {
            n = _forceBase.nodes().filter(filterVisible).sort(sortByOpacity);
            l = n.length;

            i = 100;

            bufCtx.globalAlpha = i * .01;

            while(--l > -1) {
                d = n[l];

                if (i != curOpacity(d)) {
                    i = curOpacity(d);
                    bufCtx.globalAlpha = i * .01;
                }

                x = Math.floor(d.x);
                y = Math.floor(d.y);

                if (setting.showParent) {
                    c = curColor(d);
                    bufCtx.save();

                    if (setting.showPaddingCircle) {
                        bufCtx.beginPath();
                        bufCtx.strokeStyle = "none";
                        bufCtx.fillStyle = "#ff0000";
                        bufCtx.arc(x, y, nr(d) + setting.padding, 0, PI_CIRCLE, true);
                        bufCtx.closePath();
                        bufCtx.fill();
                        bufCtx.stroke();
                    }

                    bufCtx.beginPath();
                    bufCtx.strokeStyle = "transparent";
                    bufCtx.fillStyle = setting.useImage ? "transparent" : c;
                    bufCtx.arc(x, y, nr(d), 0, PI_CIRCLE, true);
                    bufCtx.closePath();
                    bufCtx.fill();
                    bufCtx.stroke();
                    img = d.img && d.img.width > 0 && d.img.height > 0 ? d.img : defImg;
                    if (setting.useImage && img.width > 0 && img.height > 0) {
                        bufCtx.clip();
                        iw = img.width;
                        ih = img.height;

                        if (iw == ih) {
                            ih = iw = nr(d);
                        }
                        else if (iw > ih) {
                            ih = (ih/iw) * nr(d) * 1.2;
                            iw = nr(d) * 1.2;
                        }
                        else {
                            iw = (iw/ih) * nr(d) * 1.2;
                            ih = nr(d) * 1.2;
                        }

                        bufCtx.drawImage(img, x - iw, y - ih, iw * 2, ih * 2);
                    }

                    bufCtx.restore();
                }

                if (setting.showLabel) {
                    c = d.flash ? "white" : "gray";

                    bufCtx.fillStyle = c;
                    bufCtx.fillText(d.nodeValue.shortName, x, y + nr(d) * 1.5);
                }
            }
        }//end of if (setting.showParent || setting.showLabel) {

        bufCtx.restore();

    }//end of redrawCanvas


    /**
     * clear canvas and redraw
     */
    function render() {//used in run():271
        requestAnimationFrame(render);

        lHis && lHis.style("display", setting.showHistogram ? null : "none");
        lLeg && lLeg.style("display", setting.showCountExt ? null : "none");

        if (valid) return;

        valid = true;

        ctx.save();
        ctx.clearRect(0, 0, _w, _h);

        redrawCanvas();//:618

        ctx.drawImage(bufCanvas, 0, 0);
        ctx.restore();

        valid = false;

        // console.log("rendered!");
    }

    /**
     * _force on tick handler
     */
    function tick() {//use in runShow:1364
        if (_force.nodes()) {

            if (setting.groupByRegion)
                _forceBase
                    .friction(.75)
                    .gravity(0)
                    .nodes()
                    .forEach(clusterParent(0.025));
            else
                _forceBase
                    .friction(.9)
                    .gravity(setting.padding * .001);

            _force.nodes()
                .forEach(cluster(0.025));

            _forceBase.nodes(
                _forceBase.nodes()
                    .filter(function(d) {
                        blink(d, !d.links && setting.parentLife > 0);
                        if (d.visible && d.links === 0 && setting.parentLife > 0) {
                            d.flash = 0;
                            d.alive = d.alive / 10;
                        }
                        return d.visible;
                    })
            );
            if (setting.groupByRegion)
                _forceBase.links(regionLinks);
        }

        _forceBase.resume();
        _force.resume();
    }//end of tick()

    // Move d to be adjacent to the cluster node.
    function cluster(alpha) {//used in tick

        parentHash.forEach(function(k, d) {
            d.links = 0;
        });

        return function(d) {
            blink(d, setting.childLife > 0);
            if (!d.parent || !d.visible)
                return;

            var node = d.parent,
                l,
                r,
                x,
                y;

            if (node == d) return;
            node.links++;

            x = d.x - node.x;
            y = d.y - node.y;
            l = Math.sqrt(x * x + y * y);
            r = radius(nr(d)) / 2 + (nr(node) + setting.padding);
            if (l != r) {
                l = (l - r) / (l || 1) * (alpha || 1);
                x *= l;
                y *= l;

                d.x -= x;
                d.y -= y;
            }
            d.paths && (d.flash/* || d.paths.length > 2*/) && d.paths.push({
                x : d.x,
                y : d.y
            });
        };
    }

    function clusterParent(alpha) {//used in tick

        return function(d) {
            if (!d.region || !d.visible)
                return;

            var node = d.region,
                    l,
                    r,
                    x,
                    y;

            if (node == d) return;
            node.links++;

            x = d.x - node.x;
            y = d.y - node.y;
            l = Math.sqrt(x * x + y * y);
            r = nr(d) + (nr(node) + setting.padding * 2);
            if (l != r) {
                l = (l - r) / (l || 1) * (alpha || 1);
                x *= l;
                y *= l;

                d.x -= x;
                d.y -= y;
            }
        };
    }

    /**
     * draw legend in bottom 
     */
    function appendExtLegend(key){//used in loop
        if (!layer)
            return;

        var data = [],
            w3 = _w / 3,
            ml = 5,//_w * .01,
            mb = 18,
            h2 = (_h / 2) - mb,
            bw = 2,
            ny
            ;

        var y = d3.scale.linear()
            .range([0, h2])
            .domain([0, extMax]);

        lHis = (lHis || layer.insert("g", ":first-child"))
            .attr("width", w3)
            .attr("height", h2)
            .attr("transform", "translate(" + [ ml , _h - h2 - mb ] + ")");

        if (!key)
            return;

        ny = h2;
        extHash.forEach(function(k, d) {
            var obj = {
                key : k,
                h : y(d.currents[key] || 0),
                color : d.color
            };
            obj.y = ny -= obj.h;
            data.push(obj);
        });

        updateExtHistogram();//move forward

        var g = lHis.append("g")
            .attr("class", "colStack")
            .datum({ x : 0, max : w3, w : bw })
            .style("opacity", 0);

        g.selectAll("rect")
            .data(data)
            .enter()
            .append("rect")
            .attr("x", 0)
            .attr("y", function(d) {  return d.y;  })
            .attr("width", bw)
            .attr("height", function(d) { return d.h; })
            .attr("fill", function(d) { return d.color; })
        ;

        g.style("opacity", 1)
            .attr("transform", function(d) {
                return "translate(" + [ d.x, 0] + ")";
            });
    }

    function updateExtHistogram() {//used in appendExtLegend
        if (!lHis || lHis.selectAll(".colStack").empty())
            return;

        lHis.selectAll(".colStack")
            .attr("transform", function(d) {
                return "translate(" + [ d.x += d.w/2, 0] + ")";
            })
            .filter(function(d) {
                return d.x > d.max;
            })
            .remove();

        //console.log("update ext histogram...");
    }

    function lme(d) {//legend mouse over: used in initLegend
        selectedExt = d.value;

        tooltip.html([
            "<b style='text-shadow: 1px 1px 1px #000; color:",
            d.value.color,
            "'>", d.key, "</b>",
            "<hr>",
            "Number of contract: <b>",
            d.value.now.length,
            "</b><br/>Money ($): <b>",
            th(d3.sum(d3.values(d.value.values))),
            "M.</b><br/>"
        ].join(''));
        tooltip.style("display", "block");
        updateLegend();
    }

    function lml() {//legend mouse leave: used in initLegend
        selectedExt = null;
        tooltip.style("display", null);
        updateLegend();
    }

    function lmm(d) {//lgend mouse move: used in initLegend
        moveToolTip(d, d3.event);
    }

    function legColor(d) {//use in legColor
        var ext = selectedExt;
        if (!ext && selected
            && selected.type == typeNode.child
            && selected.ext)
            ext = selected.ext;

        return ext
                ? ext == d.value
                    ? d.value.color
                    : colorless
                : d.value.color;
    }

    function initLegend() {//used in runShow
        if (!layer)
            return;

        var mt = 48,
            ml = 5,//_w * .01,
            h2 = _h / 2 - mt,
            w3 = _w / 3
            ;

        lLeg = (lLeg || layer.append("g"))
            .attr("width", w3)
            .attr("height", h2)
            .attr("transform", "translate(" + [ml, mt] + ")");

        lLeg.selectAll("*").remove();

        var g = lLeg.selectAll(".gLeg")
            .data(extHash.entries(), function(d) { return d.key; });

        g.exit().remove();

        g.enter().append("g")
            .on("mouseover", lme)
            .on("mousemove", lmm)
            .on("mouseout", lml)
            .attr("class", "gLeg")
            .attr("transform", function(d, i) {
                return "translate(" + [0, i * 18] + ")";
            })
            .style("visibility", "hidden")
        ;
        g.append("rect")
            .attr("height", 16)
            .style("fill", legColor)
        ;
        g.append("text")
            .attr("class", "gttLeg")
            .style("font-size", "13px")
            .text(function(d) { return d.key; })
            .style("fill", function(d) { return d3.rgb(d.value.color).brighter().brighter(); })
        ;

        g.append("text")
            .attr("class", "gtLeg")
            .style("font-size", "11px")
            .attr("transform", "translate(" + [2, 12] + ")")
        ;
    }

    function sortLeg(b, a) {//used in updateLegend
        return d3.ascending(a.value.now.length, b.value.now.length);
    }

    function sortLegK(b, a) {//used in updateLegend
        return d3.ascending(a.key, b.key);
    }

    function updateLegend() {//used in moveToolTip, reCalc, lme, lml
        if (!lLeg || lLeg.empty())
            return;

        var g = lLeg.selectAll(".gLeg");

        function wl(d) {
            return d.value.now.length;
        }

        g.selectAll(".gtLeg")
            .text(wl)
        ;

        var wb = d3.max(g.selectAll(".gtLeg"), function(d) {
            return d[0].clientWidth || d[0].getComputedTextLength();
        }) + 4;

        g.selectAll("rect")
            .style("fill", legColor)
            .attr("width", wb)
        ;

        g.selectAll(".gttLeg")
            .attr("transform", "translate(" + [wb + 2, 12] + ")")
        ;

        g.sort(sortLegK).sort(sortLeg)
            .style("visibility", function(d, i) {
                return !wl(d) || i * 18 > lLeg.attr("height") ? "hidden" : "visible";
            })
            //.transition()
            //.duration(500)
            .attr("transform", function(d, i) {
                return "translate(" + [0, i * 18] + ")";
            })
        ;

    }

    var tooltip;

    function showToolTip(d) {//used in movem
        var res;
        if (!d) {
            tooltip.style("display", "none");
            return;
        }
        if (tooltip.style("display") == "none") {
            res = [];

            if (d.type == typeNode.parent) {
                res = [
                    d.img && d.img.width > 0 && d.img.height > 0 ? d.img.outerHTML : "",
                    " Country: <b>",
                    d.nodeValue.shortName,
                    "</b><hr/>Supplied ($): <b>",
                    th(d.nodeValue.supplied),
                    "M.</b><br/>Borrowed ($): <b>",
                    th(d.nodeValue.borrowed),
                    "M.</b><br/>"
                ];
            }
            else {
                res = [
                    "Contract: <b>",
                    d.nodeValue.contract.desc,
                    "</b><br/>Date: <b>",
                    shortTimeFormat(d.nodeValue.contract.date),
                    "</b><hr/>Project: <b>",
                    "(", d.nodeValue.project.id, ") ",
                    d.nodeValue.project.name,
                    "</b><br/>Product line: <b",
                    cat == "Product line" ? ' style="text-shadow: 0 0 2px rgba(0, 0, 0, .8);color:' + extColor(d.nodeValue[cat]) + '"' : "",
                    ">",
                    d.nodeValue.product,
                    "</b><br/>Major Sector: <b",
                    cat == "Major Sector" ? ' style="text-shadow: 0 0 2px rgba(0, 0, 0, .8);color:' + extColor(d.nodeValue[cat]) + '"' : "",
                    ">",
                    d.nodeValue.sector,
                    "</b><hr/>Procurement: <b>",
                    "</b><br/>• Type: <b",
                    cat == "Procurement Type" ? ' style="text-shadow: 0 0 2px rgba(0, 0, 0, .8);color:' + extColor(d.nodeValue[cat]) + '"' : "",
                    ">",
                    d.nodeValue.procurement.type,
                    "</b><br/>• Method: <b",
                    cat == "Procurement Method" ? ' style="text-shadow: 0 0 2px rgba(0, 0, 0, .8);color:' + extColor(d.nodeValue[cat]) + '"' : "",
                    ">",
                    d.nodeValue.procurement.method,
                    "</b><br/>• Category: <b",
                    cat == "Procurement Category" ? ' style="text-shadow: 0 0 2px rgba(0, 0, 0, .8);color:' + extColor(d.nodeValue[cat]) + '"' : "",
                    ">",
                    d.nodeValue.procurement.category,
                    "</b><hr/>Region: <b>",
                    d.nodeValue.Region,
                    "</b><br/>Supplier: <b>",
                    d.nodeValue.supplier.name,
                    "</b><br/>Borrower: <b>",
                    d.nodeValue.borrower.name,
                    "</b><br/>Borrowed ($): <b>",
                    th(+d.nodeValue),
                    "M.</b><br/>"
                ];
            }

            tooltip.html(res.join(''));
            tooltip.style("display", "block");
        }
    }

    function moveToolTip(d, event) {//used in movem
        event = event || d3.event;
        if (d && event) {
            tooltip
                .style("top", event.pageY > _h / 2 ? (event.pageY - tooltip.node().clientHeight - 16) + "px" : (event.pageY + 16) + "px")
                .style("left", event.pageX > _w / 2 ? (event.pageX - tooltip.node().clientWidth - 16) + "px" : (event.pageX + 16) + "px")
            ;
        }
        updateLegend();
    }

    function movem(d) {//show and move tooltip: used in runShow
        var item = arguments.length > 1 && arguments[1] instanceof HTMLCanvasElement ? arguments[1] : this;
        d = null;
        if (selected) {
            var od = selected;
            if (contain(od, d3.mouse(item)))
                d = od;
            if (!d) {
                od && (od.fixed &= 3);
                selected = null;
                d3.select("body").style("cursor", "default");
            }
        }
        else
            d = getNodeFromPos(d3.mouse(item));

        if (d) {
            selected = d;
            d.fixed |= 4;
            d3.select("body").style("cursor", "pointer");
        }
        showToolTip(d, d3.event);
        moveToolTip(d, d3.event);
    }


    function move() {//on zoom: used in runShow
        lastEvent.translate = d3.event.translate.slice(0);
        lastEvent.scale = d3.event.scale;

        var tl = lastEvent.translate[0] / lastEvent.scale,
                tt = lastEvent.translate[1] / lastEvent.scale;

        xW.range([-tl, -tl + _w / lastEvent.scale])
                .domain([0, _w]);
        yH.range([-tt, -tt + _h / lastEvent.scale])
                .domain([0, _h]);

        valid = false;
    }
    //==================== public api =========================================
    vis.runShow = function(data, dom, w, h, asetting) {//used in request handle
        if (typeof _worker !== "undefined")
            clearTimeout(_worker);

        _data = data.sort(function(a, b) { return d3.ascending(a, b) });
        _w = w;
        _h = h;

        if (!_data || !_data.length)
            return;

        setting = asetting;

        extColor = d3.scale.category20();
        _parentKey = function(d) { return d.key; };
        _childKey = function(d) { return d.id; };

        dateRange = d3.extent(data, function(d) {
            return d.date;
        });

        layer = dom;
        layer.selectAll("*").remove();

        lastEvent = {
            translate: [0, 0],
            scale : 1
        };

        xW = d3.scale.linear()
                .range([0, w])
                .domain([0, w]);

        yH = d3.scale.linear()
                .range([0, h])
                .domain([0, h]);

        var zoom = d3.behavior.zoom()
                .scaleExtent([.1, 8])
                .scale(1)
                .translate([0, 0])
                .on("zoom", move);

        canvas = layer.append("canvas")
            .text("This browser don't support element type of Canvas.")
            .attr("id", "mainCanvas")
            .attr("width", w)
            .attr("height", h)
            .call(zoom)
            .node();

        tooltip = tooltip || d3.select(document.body).append("div").attr("class", "tooltip");
        tooltip.style("display", "none");

        ctx = canvas.getContext("2d");

        bufCanvas = document.createElement("canvas");
        bufCanvas.width = w;
        bufCanvas.height = h;

        bufCtx = bufCanvas.getContext("2d");
        bufCtx.globalCompositeOperation = 'lighter';

        bufCtx.font = "normal normal " + setting.sizeParent / 2 + "px Tahoma";
        bufCtx.textAlign = "center";

        d3.select(dom.node().parentNode).select("#s").remove();
        lHis = null;
        lCom = null;
        lLeg = null;

        layer = d3.select(dom.node().parentNode).append("div").attr("id", "s")
            .append("svg").attr('width', w).attr("height", h);

        layer.append("g")
            .call(setting.zoom ? setting.zoom : zoom)
            .on('mousemove.tooltip', movem)
            .append("rect")
            .attr("width", w)
            .attr("height", h)
            .attr("x", 0)
            .attr("y", 0)
            .style("fill", "#ffffff")
            .style("fill-opacity", 0);

        lHis && lHis.selectAll("*").remove();

        lCom = (
                lCom || layer.append("g")
                        .attr("width", 10)
                        .attr("height", 14)
                )
                .attr("transform", "translate(" + [w/2, h - 18] + ")")
        ;
        lCom.visible = !setting.showMessage;

        lCom.selectAll("text").remove();
        lCom.showMessage = lCom.showMessage || function(text) {
            if (setting.showMessage && !lCom.visible) {
                lCom.visible = true;
                lCom.style("display", null);
            }
            else if (!setting.showMessage && lCom.visible) {
                lCom.visible = false;
                lCom.style("display", "none");
            }

            if (!text) return;

            lCom.append("text")
                    .attr("text-anchor", "middle")
                    .attr("class", "com-mess")
                    .attr("transform", "translate("+ [0, -lCom.node().childElementCount * 14] +")")
                    .text(text.split("\n")[0].substr(0, 100))
                    .transition()
                    .delay(500)
                    .duration(2000)
                    .style("fill-opacity", 1)
                    .duration(200)
                    .style("font-size", "11.2pt")
                    .transition()
                    .duration(1500)
                    .style("fill-opacity", .3)
                    .style("font-size", "11pt")
                    .each("end", function() {
                        lCom.selectAll("text").each(function(d, i) {
                            d3.select(this)
                                    .attr("transform", "translate("+ [0, -i * 14] +")");
                        });
                    })
                    .remove();
        };

        vis.pb.show()
            .pos(0)
            .max(dateRange[1] - dateRange[0])
            .label(shortTimeFormat(dateRange[0]));

        links = d3.map({});
        regionLinks = [];
        nodes = initNodes(_data);

        _force = (_force || d3.layout.force()
                .stop()
                .size([w, h])
                .friction(.75)
                .gravity(0)
                //.charge(function(d) {return -1 * radius(nr(d)); } )
                .charge(-.5)
                .on("tick", tick))//tick:914
                .nodes([])
        ;

        zoomScale = d3.scale.linear()
                .range([5, 1])
                .domain([.1, 1]);

        setting.padding = setting.padding || 0;
        _forceBase = (_forceBase || d3.layout.force()
            .stop()
            .size([w, h])
            //.linkDistance(setting.padding)
            .gravity(setting.padding * .001)
            .charge(function(d) {
                return setting.groupByRegion ? -(Math.pow(d.size, 2) + setting.padding * (d.links || 1)) : -(setting.padding + d.size) * 8;
            }))
            .nodes([])
        ;

        initLegend();

        stop = false;
        pause = false;

        run();//defined in 271

        _force.start();
        _forceBase.start();

    };//end of vis.runShow()

    vis.pauseShow = function() {
        pause = true;
    };

    vis.stopShow = function() {
        stop = true;
    };

    vis.resumeShow = function() {
        pause = false;
    };

    vis.resize = function(w, h) {
        _w = w;
        _h = h;
    }
})(vis || (vis = {}), Images);//...
