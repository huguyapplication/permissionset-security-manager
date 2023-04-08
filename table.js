//get URL params
const props = new Proxy(new URLSearchParams(window.location.search), {
    get: (searchParams, prop) => searchParams.get(prop),
});
let sfHost = props.host; // retrieve value of "host" param
let sessionId = props.sessionId;
// let sessionId = "00D8E0000009f3B!AQsAQGvcY1cS0FgQG8wJ0ApmqAkLyjNOb8LWZrFWotiYLVm5zsxGG0JZt.gPRbSdY0eWoNk.1vvCcRGRDjLHHmHMrj6sh7y2"
var excludedApiNames = ["Name", "Id", "CreatedById", "CreatedDate", "IsDeleted", "LastModifiedById", "LastModifiedDate", "SystemModstamp", "OwnerId", "LastViewedDate", "LastReferencedDate"]

var searchPSFilter = document.getElementById("searchPSFilter")
searchPSFilter.addEventListener("keyup", filterPermissionSet);
function filterPermissionSet(){
    var select = document.getElementById("permSetSelect");
    var keyword = searchPSFilter.value;
    for (var i = 0; i < select.length; i++) {
        var txt = select.options[i].text;
        if (txt.substring(0, keyword.length).toLowerCase() !== keyword.toLowerCase() && keyword.trim() !== "") {
            select.options[i].style.display = 'none';
        } else {
            select.options[i].style.display = '';
        }
    }
}

var searchObjectFilter = document.getElementById("searchObjectFilter")
searchObjectFilter.addEventListener("keyup", filterObject);
function filterObject(){
    var select = document.getElementById("objectSelect");
    var keyword = searchObjectFilter.value;
    for (var i = 0; i < select.length; i++) {
        var txt = select.options[i].text;
        if (txt.substring(0, keyword.length).toLowerCase() !== keyword.toLowerCase() && keyword.trim() !== "") {
            select.options[i].style.display = 'none';
        } else {
            select.options[i].style.display = '';
        }
    }
}

// Fonctions lancées automatiquement permettant de récupérer la listes des objets + PS
var objectsList = [""];
async function getObjectsList(){
    var url = "https://" + sfHost + "/services/data/v57.0/sobjects/"
    const response = await fetch(url,
        {
            method : "GET",
            headers : {
                "Content-Type" : "application/json; charset=UTF-8",
                "Authorization" : "Bearer " + sessionId
            }
        })
    var data = await response.json();
    for (object in data.sobjects){
        if (data.sobjects[object].createable){
            objectsList.push(data.sobjects[object].name)
        }
    }
}
getObjectsList().then((data) => {
    var objectSelect = document.getElementById("objectSelect");
    for (var i = 0; i < objectsList.length; i++){
        var opt = document.createElement("option");
        opt.value = objectsList[i];
        opt.text = objectsList[i];
        objectSelect.add(opt);
    }
})

var permsetList = {};
async function getPermissionSetsList(host, sid){
    var query = "SELECT Id, Name from PermissionSet"
    var url = "https://" + host + "/services/data/v57.0/query/?q=" + query
    
    const response = await fetch(url,
        {
            method : "GET",
            headers : {
                "Content-Type" : "application/json; charset=UTF-8",
                "Authorization" : "Bearer " + sid
            }
        })
    var data = await response.json();
    return data;
}
getPermissionSetsList(sfHost, sessionId).then((data) => {
    for (permSet in data.records){
        permsetList[data.records[permSet].Name] = data.records[permSet].Id
    }
    var permSetSelect = document.getElementById("permSetSelect");
    for (permSetName in permsetList){
        var opt = document.createElement("option");
        opt.value = permSetName;
        opt.text = permSetName;
        permSetSelect.add(opt);
    }
})

var orgList = {};
async function getOrgList(){
    let urlList = []
    chrome.tabs.query({}, tabs => {
        for (tab of tabs){
            var url = new URL(tab.url)
            var domain = url.hostname
            if (tab.url.includes("lightning.force") && !(urlList.includes(domain))){
                urlList.push(domain)
                let currentHost = domain.replace("lightning.force", "my.salesforce");
                orgList[currentHost] = "";
                chrome.runtime.sendMessage({request: "getSessionId", host : currentHost}).then((response) =>{
                    orgList[currentHost] = response
                })
            }
        }
    })
}
getOrgList();
function populateOrgSelect() {
    var orgSelect = document.getElementById("orgSelect");
    for (orgName in orgList){
        if (orgName !== sfHost){
            var opt = document.createElement("option");
            opt.value = orgName;
            opt.text = orgName;
            orgSelect.add(opt);
        }
    }
}

// Fonctions permettant de retrive la configuration
var configButton = document.getElementById("configButton");
configButton.addEventListener("click", triggerConfiguration);

function triggerConfiguration(){
    var object = document.getElementById("objectSelect").value;
    var permissionSets = [...document.getElementById("permSetSelect").options]
                            .filter(option => option.selected)
                            .map(option => "'" + option.value + "'");
    
    var saveButton = document.getElementById("saveConfig");
    saveButton.removeAttribute("hidden")

    var deployButton = document.getElementById("deployConfig");
    deployButton.removeAttribute("hidden");
    populateOrgSelect();
    var orgSelect = document.getElementById("orgSelect");
    orgSelect.removeAttribute("hidden");

    resetPermissions(object, permissionSets)
}

// Récupération et affichage des droits choisis
tabPermissionToDelete = []
fieldPermissionsToDelete = []
backupData = []
var objectPermissionToUpdate = {}
function resetPermissions(object, permissionSets){
    getTabPermissions(object, permissionSets, sfHost, sessionId).then((data) => {
        if (data !== null){
            var tabPermissions = formatTabPermissionResponse(data)
            var formattedPermissions = tabPermissions[0]
            tabPermissionToDelete = tabPermissions[1]
            renderTabPermissions(formattedPermissions, permissionSets)
        }
    })

    getObjectPermissions(object, permissionSets, sfHost, sessionId).then((data) =>{
        var objectPermission = formatObjectPermissionResponse(data);
        var formattedPermissions = objectPermission[0]
        objectPermissionToUpdate = objectPermission[1]
        renderObjectPermissions(formattedPermissions, permissionSets);
    })

    getFieldPermissions(object, permissionSets, sfHost, sessionId).then((data) => {
        var fieldPermission = formatFieldPermissionResponse(data)
        var formattedPermissions = fieldPermission[0]
        fieldPermissionsToDelete = fieldPermission[1]
        renderFieldPermission(formattedPermissions, object, permissionSets)
    })
}

// Fonctions permettant de récupérer la donnée
async function getTabPermissions(object, permissionSets, host, sid){
    var query = "Select Id, Name from TabDefinition where SobjectName = '" + object + "'"
    var url = "https://" + host + "/services/data/v57.0/query/?q=" + query;
    const tabResponse = await fetch(url, {
        method : "GET",
        headers : {
            "Content-Type" : "application/json; charset=UTF-8",
            "Authorization" : "Bearer " + sid
        }
    })
    var tabDefinition = await tabResponse.json();
    if (tabDefinition.totalSize == 1){
        var queryObject = tabDefinition.records[0].Name
        query = "Select Id, Name, Parent.Name, Visibility from PermissionSetTabSetting where Name = '" + queryObject + "' and Parent.Name IN (" + permissionSets + ")"
        url = "https://" + host + "/services/data/v57.0/query/?q=" + query;
        const response = await fetch(url,
            {
                method : "GET",
                headers : {
                    "Content-Type" : "application/json; charset=UTF-8",
                    "Authorization" : "Bearer " + sid
                }
            })
        data = await response.json()
        return data;
    }
    return null;
}

async function getObjectPermissions(object, permissionSets, host, sid){
    var query = "Select Id, Parent.Name, ParentId, PermissionsCreate, PermissionsDelete, PermissionsEdit, PermissionsRead from ObjectPermissions where SobjectType = '" + object + "' and Parent.Name IN (" + permissionSets + ")"
    var url = "https://" + host + "/services/data/v57.0/query/?q=" + query;
    const response = await fetch(url,
        {
            method : "GET",
            headers : {
                "Content-Type" : "application/json; charset=UTF-8",
                "Authorization" : "Bearer " + sid
            }
        })
    return response.json();
}

async function getFieldPermissions(object, permissionSets, host, sid){
    var query = "Select Id, Field, Parent.Name, Parent.Id, PermissionsEdit, PermissionsRead from FieldPermissions where SobjectType = '" + object + "' and Parent.Name IN (" + permissionSets + ")"
    var url = "https://" + host + "/services/data/v57.0/query/?q=" + query;
    const response = await fetch(url,
        {
            method : "GET",
            headers : {
                "Content-Type" : "application/json; charset=UTF-8",
                "Authorization" : "Bearer " + sid
            }
        })
    return response.json();
}

// Fonctions permettant de formatter les réponses JSON
function formatTabPermissionResponse(data){
    var permissionToDelete = []
    var currentDelete = []
    var dict = {}
    for (var i = 0; i < data.records.length; i++){
        currentDelete.push(data.records[i].Id)
        if (currentDelete.length === 199){
            permissionToDelete.push(currentDelete)
            currentDelete = []
        }
        dict[data.records[i].Parent.Name] = data.records[i].Visibility
    }
    permissionToDelete.push(currentDelete)
    return [dict, permissionToDelete]
}

function formatObjectPermissionResponse(data){
    var permissionToUpdate = {}
    var dict = {}
    for (var i = 0; i < data.records.length; i++){
        permissionToUpdate[data.records[i].Parent.Name] = data.records[i].Id
        dict[data.records[i].Parent.Name] = {
            "Read" : data.records[i].PermissionsRead,
            "Create" : data.records[i].PermissionsCreate,
            "Edit" : data.records[i].PermissionsEdit,
            "Delete" : data.records[i].PermissionsDelete
        }
    }
    return [dict, permissionToUpdate]
}

function formatFieldPermissionResponse(data){
    var permissionsToDelete = []
    var currentDelete = []
    var backupData = data.records;
    var dict = {}
    for (var i = 0; i < data.records.length; i++){
        currentDelete.push(data.records[i].Id)
        if (currentDelete.length === 199){
            permissionsToDelete.push(currentDelete)
            currentDelete = []
        }
        var fieldPermission = {}
        fieldPermission[data.records[i].Parent.Name] = getFieldValue(data.records[i].PermissionsEdit, data.records[i].PermissionsRead)
        dict[data.records[i].Field.split(".")[1]] = Object.assign({}, dict[data.records[i].Field.split(".")[1]], fieldPermission)
    }
    permissionsToDelete.push(currentDelete)
    return [dict, permissionsToDelete]
}

function getFieldValue(editPermission, readPermission){
    if (editPermission){
        return "Edit"
    }
    if (readPermission){
        return "Read"
    }
    return "Hidden"
}

// Fonctions annexes
// Fonction permettant d'ajouter un titre au tableau
function addCaption(table, captionText){
    var caption = document.createElement('caption');
    caption.innerText = captionText;
    table.appendChild(caption);
}

// Fonction permettant de créer le header du tableau
function buildHeader(tableTag, captionText, firstColumnHeader, permissionSets){
    //création de l'en-tête du tableau
    var table = document.getElementById(tableTag)
    table.innerHTML = "";
    addCaption(table, captionText);
    var row = document.createElement('tr');   
    var column = document.createElement("th")
    column.appendChild(document.createTextNode(firstColumnHeader));
    row.appendChild(column)
    for (i = 0; i < permissionSets.length; i++){
        var column = document.createElement("th")
        column.appendChild(document.createTextNode(permissionSets[i].replaceAll("'", "")));
        row.appendChild(column)
    }
    table.appendChild(row);
}

// Fonction permettant de gérer le click sur la cellule d'un droit d'onglet
function changeTabCellValue(event){
    var existingValue = event.target.innerText;
    var newValue = "Hidden"
    if (existingValue === "Hidden"){
        newValue = "DefaultOff"
    } 
    if (existingValue === "DefaultOff") {
        newValue = "DefaultOn"
    } 
    event.target.innerText = newValue;
}

// Fonction permettant de gérer le click sur la cellule d'un droit d'objet
function changeObjectCellValue(event){
    var existingValue = event.target.innerText;
    var newValue = ""
    if (existingValue === ""){
        newValue = "X"
    }
    event.target.innerText = newValue;
}

// Fonction permettant de gérer le click sur la cellule d'un droit de champ
function changeFieldCellValue(event){
    var existingValue = event.target.innerText;
    var newValue = "Hidden"
    if (existingValue === "Hidden"){
        newValue = "Read"
        event.target.classList.remove("cell-hidden");
        event.target.classList.add("cell-read")
    } 
    if (existingValue === "Read" && objectsFields[event.target.parentNode.getAttribute("name")].updateable) {
        newValue = "Edit"
        event.target.classList.remove("cell-hidden");
        event.target.classList.remove("cell-read");
        event.target.classList.add("cell-edit")
    } 
    if (newValue === "Hidden"){
        event.target.classList.remove("cell-edit");
        event.target.classList.remove("cell-read");
        event.target.classList.add("cell-hidden");
    }
    event.target.innerText = newValue;
}

// Fonction permettant d'ajouter une ligne au tableau des permissions liées aux champs
function buildPermissionLine(field, permissionSets, formattedPermissions){
    // on créé la ligne du tableau
    var row = document.createElement('tr');   
    row.setAttribute("name", field)
    var column = document.createElement("td")
    column.appendChild(document.createTextNode(objectsFields[field].label));
    row.appendChild(column)
    for (i = 0; i < permissionSets.length; i++){
        // on parcourt chaque permission sélectionnée
        var permissionSetName = permissionSets[i].replaceAll("'", "")
        var fieldPermissionText = "Hidden"
        if (field in formattedPermissions){
            if (permissionSetName in formattedPermissions[field]){
                fieldPermissionText = formattedPermissions[field][permissionSetName]
            }
        } else [
            fieldPermissionText = 'Hidden'
        ]    
        
        // on définit la valeur de la cellule
        var column = document.createElement('td');
        column.setAttribute("name", permissionSetName)
        column.setAttribute("class", "permission cell-"+fieldPermissionText.toLowerCase());
        column.addEventListener("click", changeFieldCellValue)
        var value = document.createTextNode(fieldPermissionText);
        column.appendChild(value);
        row.appendChild(column);
    }
    // on ajout la ligne au tableau
    var table = document.getElementById("fieldPermissions")
    table.appendChild(row);
}

// Fonction permettant de récupérer la description de l'objet concerné
var objectsFields = {}
async function getObjectDescription(object){
    objectsFields = {}
    var url = "https://" + sfHost + "/services/data/v57.0/sobjects/"+ object+"/describe/";
    const response = await fetch(url,
        {
            method : "GET",
            headers : {
                "Content-Type" : "application/json; charset=UTF-8",
                "Authorization" : "Bearer " + sessionId
            }
        })
    var data = await response.json();
    objectsFields = {};
    for (field in data.fields){
        if (!(excludedApiNames.includes(data.fields[field].name))){
            if (data.fields[field].permissionable && data.fields[field].compoundFieldName === null){
                objectsFields[data.fields[field].name] = {
                    "label" : data.fields[field].label,
                    "updateable" : data.fields[field].updateable
                }
            }
        }
    }
}

// Fonctions réalisant le rendu des droits
async function renderTabPermissions(formattedPermissions, permissionSets){
    buildHeader("tabPermissions", "Autorisations de l'onglet", "", permissionSets);
    var row = document.createElement('tr');   
    row.setAttribute("name", "tab")
    var column = document.createElement("td")
    column.appendChild(document.createTextNode("Droits"));
    row.appendChild(column)
    for (i = 0; i < permissionSets.length; i++){
        var permissionSetName = permissionSets[i].replaceAll("'", "")
        var tabPermissionText = "Hidden"
        if (permissionSetName in formattedPermissions){
            tabPermissionText = formattedPermissions[permissionSetName]
        }
        var column = document.createElement('td');
        column.setAttribute("class", "tab-permission permission")
        column.setAttribute("name", permissionSetName);
        column.addEventListener("click", changeTabCellValue)
        var value = document.createTextNode(tabPermissionText);
        column.appendChild(value);
        row.appendChild(column);
    }
    var table = document.getElementById("tabPermissions")
    table.appendChild(row);
}

async function renderObjectPermissions(formattedPermissions, permissionSets){
    buildHeader("objectPermissions", "Autorisations de l'objet", "", permissionSets);
    var objectRights = ["Read", "Create", "Edit", "Delete"];
    for (right of objectRights){
        var row = document.createElement('tr');   
        row.setAttribute("name", right)
        var column = document.createElement("td")
        column.appendChild(document.createTextNode(right));
        row.appendChild(column)
        for (i = 0; i < permissionSets.length; i++){
            // on parcourt chaque permission sélectionnée
            var permissionSetName = permissionSets[i].replaceAll("'", "")
            var fieldPermissionText = ""
            if (permissionSetName in formattedPermissions){
                if (formattedPermissions[permissionSetName][right]){
                    fieldPermissionText = "X"
                }
            }
            // on définit la valeur de la cellule
            var column = document.createElement('td');
            column.setAttribute("class", "object-permission permission")
            column.setAttribute("name", permissionSetName);
            column.addEventListener("click", changeObjectCellValue)
            var value = document.createTextNode(fieldPermissionText);
            column.appendChild(value);
            row.appendChild(column);
        }
        // on ajout la ligne au tableau
        var table = document.getElementById("objectPermissions")
        table.appendChild(row);
    }
 
}

async function renderFieldPermission(formattedPermissions, object, permissionSets){
    buildHeader("fieldPermissions", "Autorisations des champs", "Champ", permissionSets)
    // récupérer tous les champs labellisés de l'objet
    await getObjectDescription(object);
    //parcourir pour chaque champ de l'objet, les permissions récupérées
    for (let field in objectsFields){
        // ici field correspond à l'apiName du champ, exemple : npe01__HomeEmail__c
        buildPermissionLine(field, permissionSets, formattedPermissions)
    }
}

// Fonctions nécessaires à la sauvegarde de la configuration
var saveButton = document.getElementById("saveConfig");
saveButton.addEventListener("click", saveConfiguration);
// Fonction permettant de lancer la sauvegarde
async function saveConfiguration(){
    document.getElementById("save-loading").hidden = false;
    document.getElementById("save-green-tick").hidden = true;
    var tabPermissionsToSave = tabPermissionToJSON(permsetList);
    var fieldPermissionsToSave = fieldPermissionToJSON(permsetList);
    var objectPermissions = objectPermissionToJSON(permsetList, objectPermissionToUpdate);
    var objectPermissionsToSave = objectPermissions[0];
    var objectPermissionsToAdd = objectPermissions[1];
    await deleteCurrentData(sfHost, fieldPermissionsToDelete, tabPermissionToDelete, sessionId)
    await pushTabPermissionData(tabPermissionsToSave, sfHost, sessionId);
    await pushFieldPermissionData(fieldPermissionsToSave, sfHost, sessionId);
    await pushObjectPermissionDataUpdate(objectPermissionsToSave, sfHost, sessionId);
    await pushObjectPermissionDataCreate(objectPermissionsToAdd, sfHost, sessionId);
    document.getElementById("save-loading").hidden = true;
    document.getElementById("save-green-tick").hidden = false;
}

// Fonction de conversion des droits de champs vers JSON pour appel API
function fieldPermissionToJSON(psList){
    var table = document.getElementById("fieldPermissions");
    var tds = table.getElementsByClassName("permission");
    toSave = []
    var object = document.getElementById("objectSelect").value;
    // Field, Parent.Name, PermissionsEdit, PermissionsRead from FieldPermissions where SobjectType
    var currentSave = []
    for (td of tds){
        if (td.innerText !== "Hidden"){
            currentSave.push({
                attributes : {"type" : "FieldPermissions", "referenceId" : psList[td.getAttribute("name")] + "_" + td.parentNode.getAttribute("name")},
                Field : object+"."+td.parentNode.getAttribute("name"),
                SobjectType : object,
                PermissionsEdit : td.innerText === "Edit",
                PermissionsRead : td.innerText === "Edit" || td.innerText === "Read",
                ParentId : psList[td.getAttribute("name")]
            })
        }
        if (currentSave.length === 199){
            toSave.push(currentSave);
            currentSave = []
        }
    }
    toSave.push(currentSave);
    return toSave;
}

// Fonction de conversion des droits de l'objet vers JSON pour appel API
function objectPermissionToJSON(psList, existingObjectPermission){
    var table = document.getElementById("objectPermissions");
    var trs = table.getElementsByTagName("tr");
    var temp = {}
    for (tr of trs){
        if (tr.getAttribute("name") !== ""){
            right = tr.getAttribute("name")
            var tds = tr.getElementsByClassName("permission");
            for (td of tds){
                if (td.getAttribute("name") in temp){
                    temp[td.getAttribute("name")][right] = td.innerText === "X";
                } else {
                    temp[td.getAttribute("name")] = {
                        "Read" : td.innerText === "X"
                    }
                }
            }
        }
    }
    var toSave = [];
    var toAdd = [];
    var object = document.getElementById("objectSelect").value;
    var currentSave = [];
    var currentAdd = [];
    for (perm in temp){
        if (existingObjectPermission[perm] === undefined){
            currentAdd.push({
                attributes : {"type" : "ObjectPermissions", "referenceId" : psList[perm]},
                ParentId : psList[perm],
                SobjectType : object,
                PermissionsEdit : temp[perm].Edit,
                PermissionsRead : temp[perm].Read,
                PermissionsCreate : temp[perm].Create,
                PermissionsDelete : temp[perm].Delete
            })
        } else {
            currentSave.push({
                Id : existingObjectPermission[perm],
                attributes : {"type" : "ObjectPermissions", "referenceId" : psList[perm]},
                ParentId : psList[perm],
                SobjectType : object,
                PermissionsEdit : temp[perm].Edit,
                PermissionsRead : temp[perm].Read,
                PermissionsCreate : temp[perm].Create,
                PermissionsDelete : temp[perm].Delete
            })
        }
    }
    toSave.push(currentSave);
    toAdd.push(currentAdd);
    return [toSave, toAdd];

}

// Fonction de conversion des droits de l'onglet vers JSON pour appel API
function tabPermissionToJSON(psList){
    var table = document.getElementById("tabPermissions");
    var tds = table.getElementsByClassName("permission");
    toSave = []
    var object = document.getElementById("objectSelect").value;
    var name = ((object.endsWith('__c')) ? object : 'standard-'+object);
    var currentSave = []
    for (td of tds){
        if (td.innerText !== "Hidden"){
            currentSave.push({
                attributes : {"type" : "PermissionSetTabSetting", "referenceId" : psList[td.getAttribute("name")]},
                Name : name,
                Visibility : td.innerText,
                ParentId : psList[td.getAttribute("name")]
            })
        }
        if (currentSave.length === 199){
            toSave.push(currentSave);
            currentSave = []
        }
    }
    toSave.push(currentSave);
    return toSave;
}

// Fonction supprimant la data
async function deleteCurrentData(host, fieldPermToDelete, tabPermToDelete, sid){
    var recordsToDelete = fieldPermToDelete.concat(tabPermToDelete)
    for (currentToDelete of recordsToDelete){
        if (currentToDelete.length > 0){
            let url = "https://" + host + "/services/data/v57.0/composite/sobjects?ids="+currentToDelete
            await fetch(url,
                {
                    method : "DELETE",
                    headers : {
                        "Content-Type" : "application/json; charset=UTF-8",
                        "Authorization" : "Bearer " + sid
                    }
                })
        }
    }
}

// Fonction sauvegardant la data des droits des champs
async function pushFieldPermissionData(toSave, host, sid){
    for (batch of toSave){
        let url = "https://" + host + "/services/data/v57.0/composite/tree/FieldPermissions/"
        var body = {
            "records" : batch
        }
        await fetch(url,
            {
                method : "POST",
                headers : {
                    "Content-Type" : "application/json; charset=UTF-8",
                    "Authorization" : "Bearer " + sid
                },
                body : JSON.stringify(body)
            })
    }
}

// Fonction sauvegardant la data des droits de l'objet
async function pushObjectPermissionDataUpdate(toSave, host, sid){
    for (batch of toSave){
        for (objectPermission of batch){
            let url = "https://" + host + "/services/data/v57.0/sobjects/ObjectPermissions/" + objectPermission.Id
            var body = {
                "records" : batch
            }
            delete objectPermission["Id"]
            await fetch(url,
                {
                    method : "PATCH",
                    headers : {
                        "Content-Type" : "application/json; charset=UTF-8",
                        "Authorization" : "Bearer " + sid
                    },
                    body : JSON.stringify(objectPermission)
                })
        }
    }
}

// Fonction sauvegardant la data des droits de l'objet
async function pushObjectPermissionDataCreate(toSave, host, sid){
    for (batch of toSave){
        for (objectPermission of batch){
            let url = "https://" + host + "/services/data/v57.0/sobjects/ObjectPermissions/"
            var body = {
                "records" : batch
            }
            await fetch(url,
                {
                    method : "POST",
                    headers : {
                        "Content-Type" : "application/json; charset=UTF-8",
                        "Authorization" : "Bearer " + sid
                    },
                    body : JSON.stringify(objectPermission)
                })
        }
    }
}

// Fonction sauvegardant la data des droits de l'onglet
async function pushTabPermissionData(toSave, host, sid){
    for (batch of toSave){
        let url = "https://" + host + "/services/data/v57.0/composite/tree/PermissionSetTabSetting/"
        var body = {
            "records" : batch
        }
        fetch(url,
            {
                method : "POST",
                headers : {
                    "Content-Type" : "application/json; charset=UTF-8",
                    "Authorization" : "Bearer " + sid
                },
                body : JSON.stringify(body)
            })
    }
}

// Fonctions nécessaires au déploiement sur une autre org
var debloyButton = document.getElementById("deployConfig");
debloyButton.addEventListener("click", deployConfiguration);

async function deployConfiguration(){
    document.getElementById("deploy-loading").hidden = false;
    document.getElementById("deploy-green-tick").hidden = true;
    var object = document.getElementById("objectSelect").value;
    var permissionSets = [...document.getElementById("permSetSelect").options]
                            .filter(option => option.selected)
                            .map(option => "'" + option.value + "'");
    var orgSelect = document.getElementById("orgSelect").value;
    var sid = orgList[orgSelect]

    var psList = {};
    const data = await getPermissionSetsList(orgSelect, sid)
    for (permSet in data.records){
        psList[data.records[permSet].Name] = data.records[permSet].Id
    }
        
    const tabResponse = await getTabPermissions(object, permissionSets, orgSelect, sid)
    var deployTabPermissionToDelete = []
    if (tabResponse !== null){
        var deployTabPermissions = formatTabPermissionResponse(tabResponse);
        deployTabPermissionToDelete = deployTabPermissions[1];
    }
    
    const objetResponse = await getObjectPermissions(object, permissionSets, orgSelect, sid)
    var deployObjectPermission = formatObjectPermissionResponse(objetResponse);
    var deployObjectPermissionToUpdate = deployObjectPermission[1];
                
    const fieldPermission = await getFieldPermissions(object, permissionSets, orgSelect, sid)
    var deployFieldPermission = formatFieldPermissionResponse(fieldPermission)
    var deployFieldPermissionsToDelete = deployFieldPermission[1]

    var tabPermissionsToSave = tabPermissionToJSON(psList);
    var fieldPermissionsToSave = fieldPermissionToJSON(psList);
    var objectPermissions = objectPermissionToJSON(psList, deployObjectPermissionToUpdate);
    var objectPermissionsToSave = objectPermissions[0];
    var objectPermissionsToAdd = objectPermissions[1];
    await deleteCurrentData(orgSelect, deployFieldPermissionsToDelete, deployTabPermissionToDelete, sid)
    await pushTabPermissionData(tabPermissionsToSave, orgSelect, sid);
    await pushFieldPermissionData(fieldPermissionsToSave, orgSelect, sid);
    await pushObjectPermissionDataUpdate(objectPermissionsToSave, orgSelect, sid);
    await pushObjectPermissionDataCreate(objectPermissionsToAdd, orgSelect, sid);
    document.getElementById("deploy-loading").hidden = true
    document.getElementById("deploy-green-tick").hidden = false;
}