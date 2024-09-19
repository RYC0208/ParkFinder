import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteComment, fetchComments, postComment, updateComment } from "../../api/comments";
import { useCommentStore } from "../../zustand/commentStore";
import useAuthStore from "../../zustand/authStore";
import { getUserProfile } from "../../api/auth";
import { useEffect } from "react";

const Comments = ({ placeId }) => {
  const { newComment, setNewComment, editingComment, setEditingComment } = useCommentStore();

  const { token, user, setUser } = useAuthStore();

  const queryClient = useQueryClient();

  //사용자가 로그인 했는지 확인하는 함수
  const isLoggedIn = !!user && user.success;

  console.log("user =>", user);
  console.log("token =>", token);

  // 최신 유저 정보 가져오기
  const { data: latestUserInfo } = useQuery({
    queryKey: ["userInfo", user?.id],
    queryFn: () => getUserProfile(token)
  });

  // 유저 정보 업데이트
  useEffect(() => {
    if (latestUserInfo) {
      setUser(latestUserInfo);
    }
  }, [latestUserInfo, setUser]);

  //댓글 목록 불러오기
  const {
    data: comments,
    isPending,
    isError,
    error
  } = useQuery({
    queryKey: ["comments", placeId],
    queryFn: () => fetchComments(placeId)
  });

  // 새 댓글 생성
  const { mutate: add } = useMutation({
    mutationFn: (comment) => postComment({ ...comment, placeId }),
    onSuccess: () => {
      queryClient.invalidateQueries(["comments", placeId]);

      alert("댓글이 추가되었습니다!");
    }
  });

  // 댓글 삭제
  const { mutate: remove } = useMutation({
    mutationFn: deleteComment,
    onSuccess: () => {
      queryClient.invalidateQueries(["comments", placeId]);
      alert("댓글이 삭제되었습니다!");
    }
  });

  // 댓글 수정 (낙관적 업데이트 적용)
  const { mutate: edit } = useMutation({
    mutationFn: updateComment,
    onMutate: async ({ id, text }) => {
      // 이전 쿼리 데이터 취소
      await queryClient.cancelQueries(["comments", placeId]);

      // 이전 값의 스냅샷 저장
      const previousComments = queryClient.getQueryData(["comments", placeId]);

      // 새 댓글로 캐시를 즉시 업데이트
      queryClient.setQueryData(["comments", placeId], (old) =>
        old.map((comment) => (comment.id === id ? { ...comment, text } : comment))
      );

      // 수정 모드 즉시 종료
      setEditingComment(null, "");

      // 이전 값 오류때 쓸 수도 있으니 리턴해줌
      return { previousComments };
    },
    onError: (err, newComment, context) => {
      //에러가 발생하면 이전 값으로 콜백
      queryClient.setQueryData(["comments", placeId], context.previousComments);
      alert("댓글 수정 중 오류 발생했습니다!" + err.message);
    },
    onSettled: () => {
      // 성공 여부와 관계없이 쿼리를 다시 불러옴
      queryClient.invalidateQueries(["comments", placeId]);
    }
  });

  // 수정 모드 토글 함수
  const toggleEdit = (id, text) => {
    if (editingComment.id === id) {
      setEditingComment(null, "");
    } else {
      setEditingComment(id, text);
    }
  };

  // 댓글 수정 제출 핸들러 함수
  const handleEditSubmit = (e) => {
    e.preventDefault();
    if (editingComment.text.trim() !== "") {
      edit({ id: editingComment.id, text: editingComment.text });
    }

    setEditingComment(null, "");
  };

  // 댓글 제출 핸들러 함수
  const handleSubmit = (e) => {
    e.preventDefault();

    if (newComment.trim() !== "") {
      const comment = {
        text: newComment,
        userId: user.id,
        nickname: user.nickname,
        avatar: user.avatar,
        placeId: placeId
      };

      add(comment);

      setNewComment("");
    }
  };

  // 로딩 상태 및 에러 처리
  if (isPending) return <div>로딩 중...</div>;
  if (isError) return <div>에러 발생: {error.message}</div>;

  //placeId에 해당하는 댓글만 보여주기
  const filteredComments = comments.filter((comment) => comment.placeId === placeId);
  return (
    <div>
      <h1>댓글 공간</h1>
      {/* 로그인한 사용자만 댓글 작성 폼 볼 수 있도록 */}
      {isLoggedIn ? (
        <form onSubmit={handleSubmit}>
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="댓글을 입력하세요..."
          />
          <button type="submit">댓글 작성</button>
        </form>
      ) : (
        <p>댓글을 작성하려면 로그인을 해주세요.</p>
      )}

      <div>
        {filteredComments.map((comment) => (
          <div key={comment.id}>
            {editingComment.id === comment.id ? (
              <>
                <form onSubmit={handleEditSubmit}>
                  <textarea
                    value={editingComment.text}
                    onChange={(e) => setEditingComment(comment.id, e.target.value)}
                    placeholder="수정하시려는 내용을 입력해주세요."
                  />
                  <button type="submit">완료</button>
                  <button type="button" onClick={() => setEditingComment(null, "")}>
                    취소
                  </button>
                </form>
              </>
            ) : (
              <>
                <img src={comment.avatar} alt={`${comment.nickname}의 프로필`} className="W-12 h-12 rounded-full" />
                <strong>{comment.nickname}</strong>
                <p>{comment.text}</p>
                <small>
                  {comment.userId}_{new Date(comment.createdAt).toLocaleString()}
                </small>
                {/* 자신의 댓글에만 수정/삭제 버튼 표시 */}
                {isLoggedIn && user.id === comment.userId && (
                  <>
                    <button onClick={() => toggleEdit(comment.id, comment.text)}>수정</button>
                    <button onClick={() => remove(comment.id)}>삭제</button>
                  </>
                )}
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Comments;
