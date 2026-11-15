

// Build a small horizontal bar showing grade out of 20, color-coded.
// grade: number (0-20). Returns a DOM element.
function buildGradeBar(grade) {
  var track = document.createElement('div');
  track.className = 'grade-bar-track';

  var fill = document.createElement('div');
  fill.className = 'grade-bar-fill';

  var numGrade = parseFloat(grade);
  if (isNaN(numGrade)) numGrade = 0;

  var percent = Math.max(0, Math.min(100, (numGrade / 20) * 100));
  fill.style.width = percent + '%';

  var colorClass;
  if (numGrade < 10) {
    colorClass = 'grade-bar-fail';
  } else if (numGrade < 12) {
    colorClass = 'grade-bar-low';
  } else if (numGrade < 14) {
    colorClass = 'grade-bar-mid';
  } else if (numGrade < 16) {
    colorClass = 'grade-bar-good';
  } else {
    colorClass = 'grade-bar-great';
  }
  fill.classList.add(colorClass);

  track.appendChild(fill);
  return track;
}


function parseResultsNumber(value) {
  if (value === undefined || value === null || String(value).trim() === '') return NaN;
  return parseFloat(String(value).replace(',', '.'));
}


function showDetailsOverlay(titleText, detailRows, extraContent) {
  var overlay = document.createElement('div');
  overlay.className = 'event-details-overlay';
  overlay.tabIndex = -1;

  var panel = document.createElement('div');
  panel.className = 'event-details-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'true');
  panel.setAttribute('aria-label', titleText || 'Details');

  var closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'event-details-close';
  closeButton.setAttribute('aria-label', 'Sluiten');
  closeButton.textContent = '\u00d7';
  panel.appendChild(closeButton);

  var title = document.createElement('div');
  title.className = 'event-details-title';
  title.textContent = titleText || '';
  panel.appendChild(title);

  (detailRows || []).forEach(function (detail) {
    if (!detail || detail.value === undefined || detail.value === null || detail.value === '') return;

    var row = document.createElement('div');
    row.className = 'event-details-row';

    var label = document.createElement('span');
    label.className = 'event-details-label';
    label.textContent = detail.label || '';
    row.appendChild(label);

    var value = document.createElement('span');
    value.className = 'event-details-value';
    value.textContent = String(detail.value);
    row.appendChild(value);

    panel.appendChild(row);
  });

  if (extraContent) panel.appendChild(extraContent);

  var note = document.createElement('div');
  note.className = 'event-details-note';
  note.textContent = 'Klik buiten het venster of op \u00d7 om te sluiten.';
  panel.appendChild(note);

  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  function closeDetails() {
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    document.removeEventListener('keydown', handleKeydown);
  }

  function handleKeydown(event) {
    if (event.key === 'Escape') closeDetails();
  }

  closeButton.addEventListener('click', closeDetails);
  overlay.addEventListener('click', function (event) {
    if (event.target === overlay) closeDetails();
  });
  document.addEventListener('keydown', handleKeydown);
  closeButton.focus();

  return overlay;
}

// Load results from Google Apps Script JSONP, with a click-to-expand breakdown per course.
function loadResultsList(jsonUrl, containerId) {
  var container = document.getElementById(containerId);
  var yearSelect = document.getElementById('year-filter');
  var semesterSelect = document.getElementById('semester-filter');
  if (!container || !yearSelect || !semesterSelect) return;

  function showMessage(message) {
    var messageElement = document.createElement('div');
    messageElement.className = 'empty-msg';
    messageElement.textContent = message;
    container.innerHTML = '';
    container.appendChild(messageElement);
  }

  function showError(error) {
    console.error('Resultaten konden niet worden geladen:', error);
    showMessage('Kon gegevens niet laden: ' + error.message);
    var badge = document.getElementById('avg-score');
    if (badge) badge.textContent = 'gem. -- /20';
  }

  if (jsonUrl.indexOf('PASTE_DEPLOYMENT_ID') !== -1 ||
      !/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec\/?$/.test(jsonUrl)) {
    showError(new Error('Stel eerst de URL van de gedeployde Apps Script-webapp in.'));
    return;
  }

  var callbackName = '__resultsJsonp' + Date.now() + Math.floor(Math.random() * 1000000);
  var script = document.createElement('script');
  var timeout;

  function cleanup() {
    clearTimeout(timeout);
    delete window[callbackName];
    if (script.parentNode) script.parentNode.removeChild(script);
  }

  window[callbackName] = function (rows) {
    cleanup();
    try {
      if (rows && rows.error) throw new Error(rows.error);
      if (!Array.isArray(rows)) throw new Error('De JSON moet een lijst van vakken bevatten.');
      if (rows.length === 0) {
        showMessage('Nog geen gegevens.');
        return;
      }

      rows.forEach(function (row, index) {
        if (!row || typeof row.courseName !== 'string' || !row.courseName.trim()) {
          throw new Error('Vak op positie ' + (index + 1) + ' mist courseName.');
        }
        if (row.partials !== undefined && !Array.isArray(row.partials)) {
          throw new Error('De partials van "' + row.courseName + '" moeten een lijst zijn.');
        }
      });

      var years = [];
      var semesters = [];
      rows.forEach(function (row) {
        if (row.year && years.indexOf(row.year) === -1) years.push(row.year);
        if (row.semester && semesters.indexOf(row.semester) === -1) semesters.push(row.semester);
      });
      years.sort();
      semesters.sort();

      function setOptions(select, values, label) {
        select.innerHTML = '';
        var emptyOption = document.createElement('option');
        emptyOption.value = '';
        emptyOption.textContent = label;
        select.appendChild(emptyOption);
        values.forEach(function (value) {
          var option = document.createElement('option');
          option.value = value;
          option.textContent = value;
          select.appendChild(option);
        });
      }

      setOptions(yearSelect, years, 'Alle jaren');
      setOptions(semesterSelect, semesters, 'Alle semesters');

      function filterRows() {
        var yearValue = yearSelect.value;
        var semesterValue = semesterSelect.value;
        return rows.filter(function (row) {
          if (yearValue && row.year !== yearValue) return false;
          if (semesterValue && row.semester !== semesterValue) return false;
          return true;
        });
      }

      function renderRows(filteredRows) {
        container.innerHTML = '';
        if (filteredRows.length === 0) {
          showMessage('Nog geen resultaten voor deze selectie.');
          return;
        }

        filteredRows.forEach(function (row) {
          var card = document.createElement('div');
          card.className = 'entry-card score-item';

          var title = document.createElement('div');
          title.className = 'title';
          title.textContent = row.courseName;

          var meta = document.createElement('div');
          meta.className = 'meta';
          var score = parseResultsNumber(row.score);
          var metaText = 'Score: ' + (isNaN(score) ? '\u2014' : row.score + ' / 20');
          if (row.ects) metaText += ' \u00b7 ' + row.ects + ' ECTS';
          if (row.program) metaText += ' \u00b7 ' + row.program;
          if (row.semester) metaText += ' \u00b7 ' + row.semester;
          if (row.year) metaText += ' \u00b7 ' + row.year;
          meta.textContent = metaText;

          card.appendChild(title);
          card.appendChild(meta);
          if (!isNaN(score)) card.appendChild(buildGradeBar(score));

          var components = row.partials || [];
          if (components.length > 0) {
            card.classList.add('has-breakdown');
            card.tabIndex = 0;
            card.setAttribute('role', 'button');

            var hint = document.createElement('div');
            hint.className = 'breakdown-hint';
            hint.textContent = 'Tik voor detail van deelscores';
            card.appendChild(hint);

            function openBreakdown() {
              var table = document.createElement('div');
              table.className = 'breakdown-table';

              components.forEach(function (c) {
                var rowEl = document.createElement('div');
                rowEl.className = 'breakdown-row';

                var nameEl = document.createElement('span');
                nameEl.className = 'breakdown-component';
                nameEl.textContent = c.name || '';
                rowEl.appendChild(nameEl);

                var gradeEl = document.createElement('span');
                gradeEl.className = 'breakdown-grade';
                var partialScore = parseResultsNumber(c.score);
                var gradeText = isNaN(partialScore)
                  ? 'Geen score'
                  : (partialScore >= 0 && partialScore <= 1
                    ? (partialScore * 100).toLocaleString('nl-BE') + '%'
                    : c.score + ' / 20');
                var weight = parseResultsNumber(c.weight);
                if (!isNaN(weight)) {
                  gradeText += ' (' + (weight <= 1 ? weight * 100 : weight).toLocaleString('nl-BE') + '%)';
                }
                gradeEl.textContent = gradeText;
                rowEl.appendChild(gradeEl);

                table.appendChild(rowEl);
                if (!isNaN(partialScore)) {
                  table.appendChild(buildGradeBar(partialScore >= 0 && partialScore <= 1
                    ? partialScore * 20
                    : partialScore));
                }
              });

              var period = [row.semester, row.year].filter(Boolean).join(' ');
              var detailRows = [
                { label: 'Eindscore', value: isNaN(score) ? '' : row.score + ' / 20' },
                { label: 'Periode', value: row.semester + ' ' + row.program },
                { label: 'ECTS', value: row.ects ? row.ects + ' ECTS' : '' }
              ];

              showDetailsOverlay(row.courseName, detailRows, components.length ? table : null);
            }

            card.addEventListener('click', openBreakdown);
            card.addEventListener('keydown', function (e) {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                openBreakdown();
              }
            });
          }

          container.appendChild(card);
        });
      }

      function applyFilters() {
        var filteredRows = filterRows();
        renderRows(filteredRows);
        var total = 0;
        var weight = 0;
        filteredRows.forEach(function (row) {
          var courseScore = parseResultsNumber(row.score);
          var ects = parseResultsNumber(row.ects);
          if (isNaN(courseScore) || isNaN(ects) || ects <= 0) return;
          total += courseScore * ects;
          weight += ects;
        });
        var badge = document.getElementById('avg-score');
        if (badge) badge.textContent = 'gem. ' + (weight ? (total / weight).toFixed(1) : '--') + ' /20';
        var input = document.getElementById('score-search');
        if (input && input.value.trim() !== '') {
          input.dispatchEvent(new Event('input'));
        }
      }

      yearSelect.addEventListener('change', applyFilters);
      semesterSelect.addEventListener('change', applyFilters);

      applyFilters();
    } catch (error) {
      showError(error);
    }
  };

  script.onerror = function () {
    cleanup();
    showError(new Error('De Apps Script-webapp kon niet worden bereikt.'));
  };

  timeout = setTimeout(function () {
    cleanup();
    showError(new Error('De Apps Script-webapp reageerde niet op tijd.'));
  }, 15000);
  script.src = jsonUrl + (jsonUrl.indexOf('?') === -1 ? '?' : '&') + 'callback=' + encodeURIComponent(callbackName);
  document.head.appendChild(script);
}

// Simple live search/filter for course or entry lists
function setupSearch(inputId, itemSelector, emptyMsgId) {
  var input = document.getElementById(inputId);
  if (!input) return;
  input.addEventListener('input', function () {
    var query = input.value.trim().toLowerCase();
    var items = document.querySelectorAll(itemSelector);
    var visibleCount = 0;
    items.forEach(function (item) {
      var text = item.textContent.toLowerCase();
      var match = text.indexOf(query) !== -1;
      item.style.display = match ? '' : 'none';
      if (match) visibleCount++;
    });
    var emptyMsg = document.getElementById(emptyMsgId);
    if (emptyMsg) emptyMsg.style.display = visibleCount === 0 ? 'block' : 'none';
  });
}
