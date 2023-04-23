<img src="https://raw.githubusercontent.com/huguyapplication/permissionset-security-manager/main/assets/img/icon.png" align="right" width="200px">

Permissionset-security-manager
===========================
Chrome extension to help you managing your permission sets.


Installation
------------

| [:sunny: Add to Chrome](https://chrome.google.com/webstore/detail/permission-set-security-m/ipapgphigaobpigfgkdiiceadnphankg) |
|---|

Features
-----
* Quickly view and edit tab, object and field permissions for a specific object and one or multiple permission sets.
* Quickly deploy your permission from one organization to another.
* And more...

<img alt="Overview" src="https://raw.githubusercontent.com/huguyapplication/permissionset-security-manager/main/assets/docs/doc.jpg" height="100">


Security and Privacy
-----
The Permissionset Security Manager browser extension communicates between the user's web browser and the Salesforce servers. No data is sent to other parties and no data is persisted outside of Salesforce servers after the user leaves the Permissionset Security Manager pages.
The Permissionset Security Manager communicates via the official Salesforce webservice APIs on behalf of the currently logged in user. This means the Inspector will be capable of accessing nothing but the data and features the user has been granted access to in Salesforce.

All Salesforce API calls from the Permissionset Security Manager re-uses the access token/session used by the browser to access Salesforce. To acquire this access token the Permissionset Security Manager requires permission to read browser cookie information for Salesforce domains.

About
-----
By Huguy

License
-----
MIT
