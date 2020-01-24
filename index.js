(function() {
  var myConnector = tableau.makeConnector();
  var params = getParams();
  var config = {
    tableSchema: getSchema(params.schema),
    appId: params.app_id || null,
    url: params.url ? decodeURIComponent(params.url) : "",
    title: params.title ? decodeURIComponent(params.title) : ''
  };
  if (config.title) {
    $('title').html(config.title)
  }
  setConnector();

  function setConnector() {
    myConnector.getSchema = function(schemaCallback) {
      schemaCallback([config.tableSchema]);
    };
    // Download the data
    myConnector.getData = function(table, doneCallback) {
      getData(config.appId, getUrl(config.url), function(table_id, title, data) {
        table.appendRows(data);
        tableau.connectionName = title; // This will be the data source name in Tableau
        doneCallback();
      });
    };
    tableau.registerConnector(myConnector);
  }

  function getData(app_id, url, callback, failCallback) {
    $.ajax({
      url: url,
      type: 'GET',
      data: {
        appId: app_id
      }
    })
      .done(function(resp) {

        var data = resp.GET_STATS_DATA.STATISTICAL_DATA.DATA_INF.VALUE;
        var title = resp.GET_STATS_DATA.STATISTICAL_DATA.TABLE_INF.STATISTICS_NAME;
        var table_id = resp.GET_STATS_DATA.STATISTICAL_DATA.TABLE_INF["@id"];
        var props = resp.GET_STATS_DATA.STATISTICAL_DATA.CLASS_INF.CLASS_OBJ;
        var columns = {};
        _.forEach(props, function(prop) {
          var values = {};
          if (Array.isArray(prop['CLASS'])) {
            _.forEach(prop['CLASS'], function(val) {
              values[val['@code']] = val['@name'];
            });
          } else {
            values[prop['CLASS']['@code']] = prop['CLASS']['@name'];
          }
          columns[prop['@id']] = {
            name: prop['@name'],
            values: values
          };
        });
        data = convertData(data, columns);
        callback(table_id, title, data, columns);
      })
      .fail(function(resp) {
        if (failCallback) {
          failCallback(resp);
        }
      });
  }

  function convertData(data, columns) {
    var result = [];
    data.forEach(function(record) {
      var obj = {};
      _.forEach(record, function(value, key) {
        var _key = key.replace(/^@/, "");
        if (key === _key) {
          if (key === "$") {
            _key = "value";
          } else {
            console.log("key: " + _key + " is not handle.");
          }
        }
        if (columns[_key] && columns[_key].values && columns[_key].values[value]) {
          value = columns[_key].values[value];
        }
        obj[_key] = value;
      });
      result.push(obj);
    });
    return result;
  }

  function getUrl(baseUrl) {
    if (!baseUrl) {
      return null;
    }
    var url = baseUrl.replace(/^http:\/\//, "//");
    url = location.protocol + url;
    url = url.replace(/rest\/([0-9\.]+)\/app\//, "rest/$1/app/json/");
    url = url.replace("appId=&", "");
    return url;
  }

  function getSchema(schema) {
    if (!schema) {
      return null;
    }
    return unzipSchema(decodeURIComponent(schema));
  }

  function makeSchemaZip(id, title, columns, data) {
    var firstColumns = Object.keys(_.first(data));
    var cols = [];
    _.forEach(firstColumns, function(c) {
      var col = [c, c];
      if (c === "unit") {
        col[1] = "単位";
      } else if (c === "value") {
        col[1] = "値";
      }
      cols.push(col);
    });
    _.forEach(cols, function(col) {
      if (columns[col[0]]) {
        col[1] = columns[col[0]].name;
      }
    });
    return JSON.stringify({
      id: id,
      alias: title,
      columns: cols
    });
  }

  function unzipSchema(zip) {
    var schema = JSON.parse(zip);
    schema.columns = schema.columns.map(function(c) {
      return {id: c[0], alias: c[1], dataType: tableau.dataTypeEnum.string}
    });
    return schema;
  }

  function getParams() {
    var url = document.location.href;
    if (url.match(/#/)) {
      url = RegExp.leftContext;
    }
    if (url.match(/\?/)) {
      var params = RegExp.rightContext;
    } else {
      return [];
    }
    var tmp = params.split('&');
    var param = [];
    var tmp2, key, val;
    for (var i = 0; i < tmp.length; i++) {
      tmp2 = [];
      key = '';
      val = '';

      tmp2 = tmp[i].split('=');
      key = tmp2[0];
      val = tmp2[1];
      param[key] = val;
    }
    return param;
  }

  function hideInputs() {
    $('.tableau-app').removeClass('d-none');
    $('.form-buttons').addClass('d-none');
    $('.form-app input').prop('disabled', true);
    $('.form-app textarea').prop('disabled', true);
  }

  function showInputs() {
    $('.tableau-app').addClass('d-none');
    $('.form-buttons').removeClass('d-none');
    $('.form-app input').prop('disabled', false);
    $('.form-app textarea').prop('disabled', false);
  }

  function enableOk() {
    setTimeout(function() {
      $(".ok-button").prop('disabled', false);
    }, 500);
  }

  function enableRegister() {
    setTimeout(function() {
      $("#submitButton").prop('disabled', false);
    }, 1500);
  }

  function getAppId() {
    return localStorage.getItem("app_id");
  }

  function setAppId(app_id) {
    localStorage.setItem("app_id", app_id);
  }

  function deleteAppId() {
    $('#app_id_input').val("");
    localStorage.setItem("app_id", "");
  }

  // Create event listeners for when the user submits the form
  $(document).ready(function() {
    var app_id = config.appId;
    var url = config.url;
    var schema = config.tableSchema;
    var title = ''
    if (app_id) {
      setAppId(app_id);
      $('#app_id_input').val(app_id);
    } else {
      app_id = getAppId();
      if (app_id && !url) {
        $('#app_id_input').val(app_id);
      }
    }
    if (url) {
      url = decodeURIComponent(url);
      $('#url_input').val(url);
    }
    if (app_id && url) {
      if (schema) {
        hideInputs();
        enableRegister();
      } else {
        getData(app_id, getUrl(url), function(table_id, title, data, columns) {
          var schema = makeSchemaZip(table_id, title, columns, data);
          $('#schema_input').val(schema);
          $('#title_input').val(title);
          showInputs();
          setTimeout(function() {
            $("form").submit();
          }, 300);
        }, function() {
          showInputs();
        });
      }
    } else {
      enableOk();
    }
    $("#submitButton").click(function() {
      tableau.connectionName = config.title
      tableau.submit(); // This sends the connector object to Tableau
    });
    $(".delete-api-id-button").click(function() {
      deleteAppId();
    });
  });
})();
