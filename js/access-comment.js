function loadComments(user_repo, id)
{
    $.ajax("https://api.github.com/repos/" + user_repo + "/issues/"+id+"/comments?per_page=100",
    {
        headers: {Accept: "application/vnd.github.full+json"},
        dataType: "json",
        success: function(data)
        {
            $("#comments-count").text(data.length);
            for (var i = 0; i != data.length; ++i)
            {
                var cuser = data[i].user.login;
                var cuserlink = "https://www.github.com/" + data[i].user.login;
                var clink = "https://github.com/" + user_repo + "/issues/" + id + "#issuecomment-" + data[i].url.substring(data[i].url.lastIndexOf("/")+1);
                var cbody = data[i].body_html;
                var cavatarlink = data[i].user.avatar_url;
                var cdate = Date.parse(data[i].created_at).toString("yyyy-MM-dd HH:mm:ss");

                $("#comments").append("<div class='comment'><div class='commentheader'><a class='comment-pic' href=\"" + cuserlink + '\"><img src="' + cavatarlink + '" alt="" width="40" height="40"></a></div>'+"<div class='comment-data'><div class='comment-meta'><a class='comment-user' href=\""+ cuserlink + "\">" + cuser + "</a><a class='comment-date' href=\"" + clink + "\">" + cdate + "</a></div><div class='commentbody'>" + cbody + "</div></div></div>");
            }
        }
    });
}