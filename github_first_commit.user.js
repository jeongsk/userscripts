// ==UserScript==
// @name          GitHub First Commit
// @description   Add a link to a GitHub repo's first commit
// @author        chocolateboy
// @copyright     chocolateboy
// @namespace     https://github.com/chocolateboy/userscripts
// @version       2.2.0
// @license       GPL: http://www.gnu.org/copyleft/gpl.html
// @include       https://github.com/*/*
// @require       https://code.jquery.com/jquery-3.3.1.min.js
// @require       https://cdn.rawgit.com/eclecto/jQuery-onMutate/79bbb2b8caccabfc9b9ade046fe63f15f593fef6/src/jquery.onmutate.min.js
// @grant         GM_log
// ==/UserScript==

// XXX note: the unused grant is a workaround for a Greasemonkey bug:
// https://github.com/greasemonkey/greasemonkey/issues/1614

const COMMIT_BAR = 'div.commit-tease.js-details-container > span.float-right'

const FIRST_COMMIT =
    `<span id="first-commit">
        |&nbsp;
        <a id="first-commit-link" style="cursor: pointer" class="message">First commit</a>
    </span>`

// this function extracts (and navigates to) the URL of the repo's first-commit.
// it is based on:
//
//     https://gist.github.com/pitaj/e52862409dd5726711214a55189f332d
//
// similar/related snippets are listed here:
//
//     https://github.com/wong2/first-commit/issues/15#issuecomment-317750579
function openFirstCommit (user, repo) {
    return fetch(`https://api.github.com/repos/${user}/${repo}/commits`)
        // the `Link` header has additional URLs for paging.
        // parse the original JSON for the case where no other pages exist
        .then(res => Promise.all([res.headers.get('link'), res.json()]))

        .then(([link, commits]) => {
            if (link) {
                // the link header contains two URLs and has the following
                // format in a single line (wrapped for readability):
                //
                //     <https://api.github.com/repositories/1234/commits?page=2>;
                //     rel="next",
                //     <https://api.github.com/repositories/1234/commits?page=9>;
                //     rel="last"

                // extract the URL of the last page
                const lastPage = link.match(/^.+?<([^>]+)>;/)[1]

                // fetch the last page of results
                return fetch(lastPage).then(res => res.json())
            }

            // if no link, we know we're on the only page
            return commits
        })

        // get the last commit and extract the target URL
        .then(commits => commits[commits.length - 1].html_url)

        // navigate there
        .then(url => location.href = url)
}

// add the "First commit" link as the last child of the commit bar
function addLink ($commitBar) {
    const [user, repo] = $('meta[name="octolytics-dimension-repository_network_root_nwo"]')
        .attr('content')
        .split('/')

    // the "First commit" link already exists when navigating to a repo's
    // homepage via the back button. however, resurrecting the link in this way
    // causes its onclick event handler to be unregistered (XXX why?), so we
    // need to re-attach it
    let $firstCommit = $commitBar.find('#first-commit')

    if (!$firstCommit.length) {
        $firstCommit = $(FIRST_COMMIT)
        $commitBar.append($firstCommit)
    }

    const $link = $firstCommit.find('#first-commit-link')

    $link.on('click', event => {
        $link.text('Loading...')
        openFirstCommit(user, repo)
        return false
    })
}

// the commit bar (div.commit-tease) is statically defined in the HTML
// for users who aren't logged in. for logged in users, it's loaded dynamically
// via an <include-fragment> custom element:
//
//     https://github.com/github/include-fragment-element
//
// jQuery-onMutate fires the callback immediately if the element already exists,
// so it handles both cases

// #js-repo-pjax-container is only created on repo homepages
// see here for more details: https://github.com/Mottie/GitHub-userscripts/wiki/How-to
$('#js-repo-pjax-container').onCreate(COMMIT_BAR, addLink, true /* multi */)
