const $ = require("jquery");
const electron = require("electron");
const fs = require("fs");
const dialog = require("electron").remote.dialog;

$(document).ready(
    function () {
        let db;
        $("#grid .cell").on("click", function () {
            let rid = Number($(this).attr("rowId"));
            let cid = Number($(this).attr("colId"));
            let ciAdrr = String.fromCharCode(cid + 65);
            $("#address-container").val(ciAdrr + (rid + 1));

            let { rowId, colId } = getRcFromAddress(ciAdrr + (rid + 1));
            const cellObject = db[rowId][colId];
            
            $("#formula-container").val(cellObject.formula);
            lsc = this;
            if (cellObject.bold) {
                $("#bold").addClass("active")
            } else {
                $("#bold").removeClass("active")
    
            }
            if (cellObject.underline) {
                $("#underline").addClass("active")
            } else {
                $("#underline").removeClass("active")
            }
            if (cellObject.italic) {
                $("#italic").addClass("active")
            } else {
                $("#italic").removeClass("active")
            }
        })

        $("#bold").on("click", function () {
            $(this).toggleClass("active");
            let { rowId, colId } = getRcFromELem(lsc);
            let cellObject = db[rowId][colId];
            $(lsc).css("font-weight", cellObject.bold ? "normal" : "bold");
            cellObject.bold = !cellObject.bold;
        })

        $("#underline").on("click", function () {
            $(this).toggleClass("active");
            let { rowId, colId } = getRcFromELem(lsc);
            let cellObject = db[rowId][colId];
            $(lsc).css("text-decoration", cellObject.underline ? "none" : "underline");
            cellObject.underline = !cellObject.underline;
        })

        $("#italic").on("click", function () {
            $(this).toggleClass("active");
            let { rowId, colId } = getRcFromELem(lsc);
            let cellObject = db[rowId][colId];
            $(lsc).css("font-style", cellObject.italic ? "normal" : "italic");
            cellObject.italic = !cellObject.italic;
        })

        $(".menu-items").on("click", function () {
            $(".menu-options-item").removeClass("selected");            
            let id = $(this).attr("id");
            $(".menu-items").removeClass("menu-selected");
            $(`#${id}`).addClass("menu-selected");
            $(`#${id}-options`).addClass("selected");
        })

        //managing height of left most column 
        $("#grid .cell").on("keyup", function () {
            let height = $(this).height();
            // console.log(height);
            let rowId = $(this).attr("rowId");
            let lcArr = $("#left-column .cell");
            let myCol = lcArr[rowId];
            $(myCol).css("height", height);
        })

        //handling scroll
        $("#grid-container").on("scroll",function(){
            let vS = $(this).scrollTop();
            let hS = $(this).scrollLeft();

            $("#top-left-cell,#top-row").css("top", vS);
            $("#top-left-cell,#left-column").css("left", hS);
        })

        //new function
        $("#New").on("click", function () {
            //create database
            db = [];
            let rows = $("#grid").find(".row");
            // console.log(rows.length);
            for (let i = 0; i < rows.length; i++) {
                let row = [];
                let cRowCells = $(rows[i]).find(".cell");
                for (let j = 0; j < cRowCells.length; j++) {
                    
                    let cell = {
                        value : "",
                        formula : "",
                        downstream : [],  //children array
                        upstream : [],  //parent array
                        bold : false,
                        italic : false,
                        underline : false
                    }

                    row.push(cell);

                    $(cRowCells[j]).html("");
                }
                db.push(row);
            }

            let allCells = $("#grid .cell");
            $(allCells[0]).trigger("click");
        })

        //filling 'db' to help us in save
        // $("#grid .cell").on("keyup", function () {
        //     let rId = $(this).attr("rowId");
        //     let cId = $(this).attr("colId");
        //     db[rId][cId] = $(this).html();
        //     // console.log(db);
        // })  //this event accurs every time a key is pressed (it is heavy)

        //"blur" is used so that the event occurs only one time after a click is encountered on a cell other than that cell
        $("#grid .cell").on("blur", function () {
            let {rId , cId} = getRc(this);
            let cellObject = getCellObject(rId,cId);
            if($(this).html() == cellObject.value){
                return; 
            }

            if(cellObject.formula){  // if the cell already contains a formula
                removeFormula(rId , cId);
            }
            cellObject.value = $(this).html();
            // update cell --> update self and its downstream children
            updateCell(rId,cId,$(this).html(),cellObject);
            // db[rId][cId] = $(this).html();  
        })  

        $("#formula-container").on("blur", function(){
            let address = $("#address-container").val();

            let{rowId , colId} = getRcFromAddress(address);

            let cellObject = getCellObject(rowId , colId);

            if(cellObject.formula){  // if the cell already contains a formula 
                removeFormula(rowId,colId);
            }

            let formula = $(this).val();
            cellObject.formula = formula;
            //set downStream and upstream
            setFormula(rowId,colId,formula);
            //get evaluated Value
            let evaluatedVal = evaluate(cellObject);
            //update the cell 
            updateCell(rowId,colId,evaluatedVal,cellObject);
        })

        function setFormula(rowId , colId , formula){
            
            let formulaComponent = formula.split(" ");
            // console.log(formulaComponent);
            for(let i=0 ; i<formulaComponent.length ; i++){
                let component = formulaComponent[i].charCodeAt(0);
                if(component>=65 && component<=90){
                    let parentRc = getRcFromAddress(formulaComponent[i]);
                    let parentObject = getCellObject(parentRc.rowId , parentRc.colId);
                    // console.log(parentObject);
                    parentObject.downstream.push({rowId,colId});  //creating children array
                    
                    db[rowId][colId].upstream.push({  //creating parent array
                        rowId : parentRc.rowId , 
                        colId : parentRc.colId});
                }
            }
        }

        function removeFormula(rowId, colId){
            let cellObject = db[rowId][colId];
            //getting upstream array of cellObject
            let parentArray = cellObject.upstream;
            
            for(let i = 0; i<parentArray.length ; i++){
                let parentObject = db[parentArray[i].rowId][parentArray[i].colId];
                let idx = parentObject.downstream.findIndex(function(elemRc){
                    return (elemRc.rowId == rowId && elemRc.colId == colId);
                })
                parentObject.downstream.splice(idx,1);
            }

            cellObject.formula = "";
            cellObject.upstream = [];
        }

        function getRc(elem){
            let rId = $(elem).attr("rowId");
            let cId = $(elem).attr("colId");
            return {rId , cId};
        }

        function updateCell(rowId , colId , val , cellObject){
            $(`#grid .cell[rowId=${rowId}][colId=${colId}]`).html(val);  //updating in UI
            cellObject.value = val;  // updating in database

            for(let i = 0;i<cellObject.downstream.length;i++){
                let childRc = cellObject.downstream[i];
                let childObject = db[childRc.rowId][childRc.colId];

                let evaluatedVal = evaluate(childObject);
                updateCell(childRc.rowId , childRc.colId , evaluatedVal , childObject);
            }

        }   
        
        function getCellObject(rowId , colId){
            let cellObject = db[rowId][colId];
            return cellObject;
        }

        function getRcFromAddress(address){
            let colId = address.charCodeAt(0) - 65;
            let rowId = Number(address.substring(1))-1;

            return {rowId , colId} ;
        }

        function evaluate(cellObject){
            let formula = cellObject.formula;

            let formulaComponent = formula.split(" ");

            for(let i = 0;i<formulaComponent.length;i++){
                let code = formulaComponent[i].charCodeAt(0);
                if(code>=65  && code<=90){
                    let parentRc = getRcFromAddress(formulaComponent[i]);
                    let fparent = db[parentRc.rowId][parentRc.colId];
                    let value = fparent.value;
                    formula = formula.replace(formulaComponent[i] , value);
                }
            }

            console.log(formula);
            let ans = eval(formula);
            return ans;
        }

        function getRcFromELem(elem) {
            let rowId = $(elem).attr("rowId");
            let colId = $(elem).attr("colId");
            return { rowId, colId };
        }
        //save function
        $("#Save").on("click",async function(){
            let sdb = await dialog.showOpenDialog(); //save database
            let jsonData = JSON.stringify(db);
            fs.writeFileSync(sdb.filePaths[0] , jsonData);
        })

        //open function
        $("#Open").on("click", async function(){
            let odb = await dialog.showOpenDialog();
            let fp = odb.filePaths[0];
            let content = fs.readFileSync(fp);
            db = JSON.parse(content);

            let rows = $("#grid").find(".row");
            for(let i=0 ;i<rows.length;i++){
                let cRowCells = $(rows[i]).find(".cell");
                for(let j = 0;j<cRowCells.length;j++){
                    $(cRowCells[j]).html(db[i][j]);
                }
            }
        })

        function init() {
            $("#File").trigger("click");
            $("#New").trigger("click");
        }
        init();
    })