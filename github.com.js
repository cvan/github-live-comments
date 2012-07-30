(function() {

var $document = $(document),
    old_title = '',
    hidden,
    state,
    visibilityChange;

if (typeof document.hidden !== 'undefined') {
    hidden = 'hidden';
    visibilityChange = 'visibilitychange';
    state = 'visibilityState';
} else if (typeof document.mozHidden !== 'undefined') {
    hidden = 'mozHidden';
    visibilityChange = 'mozvisibilitychange';
    state = 'mozVisibilityState';
} else if (typeof document.msHidden !== 'undefined') {
    hidden = 'msHidden';
    visibilityChange = 'msvisibilitychange';
    state = 'msVisibilityState';
} else if (typeof document.webkitHidden !== 'undefined') {
    hidden = 'webkitHidden';
    visibilityChange = 'webkitvisibilitychange';
    state = 'webkitVisibilityState';
}

// Add a listener that constantly changes the title.
document.addEventListener(visibilityChange, function() {
    if (!document[hidden]) {
        document.title = old_title;
    }
}, false);


(function($) {
    // Intelligent poller
    // Inspired by https://github.com/blog/467-smart-js-polling
    var MIN_INTVAL = 2000,   // 2 seconds
        MAX_INTVAL = 60000 * 2,  // 2 minutes
        MAX_RUNS = 500,
        MAX_CONSECUTIVE_FAILURES = 100,
        NUM_RUNS = 0,
        NUM_CONSECUTIVE_FAILURES = 0,
        LAST_SUCCESS,
        LAST_FAILURE,
        lastSuccess;
    $.slickPulla = function(poller, wait) {
        (function startPoller(success) {
            if (NUM_RUNS++ == MAX_RUNS ||
                NUM_CONSECUTIVE_FAILURES++ == MAX_CONSECUTIVE_FAILURES) {
                return;
            }

            // Mark this as another failure?
            if (lastSuccess === false && !success) {
                NUM_CONSECUTIVE_FAILURES++;
            }
            if (success) {
                NUM_CONSECUTIVE_FAILURES = 0;
            }
            lastSuccess = success;

            // Determine interval.
            if (!wait || success) {
                // Success? Poll optimistically.
                wait = MIN_INTVAL;
            } else {
                // Failure? Back off.
                // We don't want exponential but something more than linear.
                var min = 1.05,
                    max = 1.25;
                if (NUM_CONSECUTIVE_FAILURES / MAX_CONSECUTIVE_FAILURES > .3) {
                    max = 1.75;
                }
                wait = wait * Math.min(Math.max(min, Math.random() + 1), max);
            }

            // Boost on runs completed.
            wait = wait * (1.0 + (NUM_RUNS / MAX_RUNS));

            // Boost on page visibility.
            if (document[hidden]) {
                wait = wait * 1.1;
            } else {
                wait = wait * 0.9;
            }
            wait = Math.min(Math.max(MIN_INTVAL, wait), MAX_INTVAL);

            setTimeout(function() {
                poller.call(this, startPoller);
            }, wait);
        })();
    };
})(jQuery);


// TODO: Don't notify me if I submit comments from a different tab.
var user = $('#user .name').text();

var $comments = $('tr.inline-comments .commit-comment'),
    idsRead = [],
    idsStillThere = [],
    id,
    $data,
    $item,
    pause = false,
    startTime = now = new Date().getTime(),
    timesRun = 0,
    whereami = window.location.toString();

// Build list of comments already on the page.
$.each($comments, function(idx, item) {
    idsRead.push($(item).attr('id'));
});


// TODO: Make a stylesheet.
var style;
style = '.commit-comment, .gl-notification {-webkit-transition: opacity .5s ease-in-out; -moz-transition: opacity .5s ease-in-out; transition: opacity .5s ease-in-out;}';
style += '.new-comments .unread.comment { border-color: #c33; } .new-comments .unread.comment:hover { border-color: #c00; } .new-comments .commit-comment.unread .cmeta { background: #fcc; background: -moz-linear-gradient(#F8FBFC,#fcc); background: -webkit-linear-gradient(#F8FBFC,#fcc); }';
style += '#unread-notifications { display: none; position: fixed; bottom: 15px; left: 15px; width: 200px; }';
style += '#unread-notifications.active { display: block; }';
style += '#unread-notifications .dismiss { color: #999; font-size: 11px; display: block; }';
style += '#unread-notifications .dismiss:hover { color: #666; text-decoration: none; }';
style += '#unread-notifications .dismiss:hover span { background-color: #666; }';
style += '#unread-notifications .dismiss span { background-color: #999; color: #fff; font-size: 9px; padding: 3px 6px; border-radius: 3px; position: relative; top: -1px; }';
style += '.gl-notification { border-radius: 5px; border: 1px solid #c33; background: rgba(255,200,200,.7); display: inline-block; padding: 15px 15px 15px 45px; text-decoration: none; color: #800; font-size: 12px; line-height: 14px; position: relative; margin-top: 10px; }';
style += '.gl-notification img { position: absolute; left: 15px; top: 20px; }';
style += '.gl-notification:hover { background: rgba(255,200,200,.9); border-color: #c00; text-decoration: none; }';
$('head').append('<style>' + style + '</style>');

$('body').append('<div id="unread-notifications"><a href="#" class="dismiss"><span>&times;</span> Dismiss</a></div>');

$document.on('click', '.dismiss', function(e) {
    e.preventDefault();
    $('#unread-notifications').removeClass('active').find('.gl-notification').remove();
}).on('newComment', function(e, comment) {
    var $comment = $(comment),
        $author = $comment.find('.author'),
        who = $author.find('.gravatar').html() + ' ' + $author.find('.author').text().trim(),
        what = $author.find('.action-text a[href^="#"]').text().trim(),
        where = $author.find('code a[href*="#"]'),
        whereURL = '#' + $comment.attr('id'),
        whereLabel = where.eq(0).text() + ' on line ' + where.eq(1).text().replace('L', ''),
        msg = who + ' ' + what + ' ' + whereLabel;
    $('#unread-notifications:not(.active)').addClass('active').append('<a href="' + whereURL + '" class="gl-notification">' + msg +  '</a>');
    if (document[hidden]) {
        old_title = document.title;
        document.title = $('#unread-notifications .gl-notification:last-child').text().trim();
    }
}).on('click', '.gl-notification', function() {
    var $this = $(this);
    $this.remove();
    $($this.attr('href')).removeClass('unread');
    if (!$('#unread-notifications .gl-notification').length) {
        $('#unread-notifications').removeClass('active');
    }
    document.title = old_title;
}).on('click.unread', '.commit-comment', function(e) {
    if (!$(e.target).is('a')) {
        var $this = $(this);
        if ($this.hasClass('unread')) {
            $('.gl-notification[href="#' + $this.attr('id') + '"]').remove();
            if (!$('#unread-notifications .gl-notification').length) {
                $('#unread-notifications').removeClass('active');
            }
            document.title = old_title;
        }
        $this.toggleClass('unread');
    }
});

if (whereami.indexOf('?static') === -1 && whereami.indexOf('&static') === -1) {
    $.slickPulla(function(retry) {
        // TODO: Add ability to pause.
        elapsed = new Date().getTime() - now;
        now = new Date().getTime();
        timesRun++;
        console.log('[' + (now - startTime) + 'ms] fetch #' + timesRun +
                    ' (elapsed: ' + elapsed  + ' ms)');
        $.ajax({
            url: whereami,
            method: 'get',
            beforeSend: function(xhr) {
                // Keeps jQuery from telling the server it's AJAX.
                return;
            }
        }).success(function(data) {
            $data = $(data);

            var newHeader = $data.find('.commit-comments-header').html();
            if (newHeader != $('.commit-comments-header').html()) {
                $('.commit-comments-header').html(newHeader);
            }

            idsStillThere = [];

            var newItems = false;
            // Cycle through new line comments.
            $data.find('tr.inline-comments .commit-comment').each(function(idx, item) {
                $item = $(item);
                id = $item.attr('id');
                if (id) {
                    if (idsRead.indexOf(id) === -1) {
                        var targetLine = $item.find('.action-text a[href*="/commit/"][href*="#"]').attr('href').split('#')[1],
                            $line = $('#' + targetLine);
                            $existing = $line.siblings('.inline-comments');
                        if ($existing.length) {
                            $item.addClass('unread');
                            $item.insertAfter($existing.find('.commit-comment:last-child'));
                        }
                        idsRead.push(id);
                        newItems = true;
                        $item.trigger('newComment', [$item]);
                    }
                    idsStillThere.push(id);
                }
            });

            // Cycle through deleted line comments.
            $.each(idsRead, function(idx, item) {
                // If it's not still there, delete it.
                if (idsStillThere.indexOf(item) === -1) {
                    idsRead.pop(idx);
                    console.log('deleted', item);
                    var $toDelete = $('#' + item);
                    if ($toDelete.siblings().length) {
                        $toDelete.addClass('deleted').remove();
                    } else {
                        $toDelete.closest('tr.inline-comments').addClass('deleted').remove();
                    }
                }
            });

           // Update new counts.
            $data.find('.comment-count .counter').each(function(idx, val) {
                $('.comment-count .counter').eq(idx).html(val.innerHTML);
            });

            retry(newItems);
        }).error(function(d) {
            throw 'Error:' + d;
        });
    });
}

})();
