"use client";
import React, { useEffect, useRef, useState } from 'react';
import NavBar from "../components/navbar";
import { SignOutButton } from '@clerk/nextjs';
import axios from 'axios';
import { Textarea } from '@nextui-org/react';
import { followUser, getLikedPosts, updateDescription } from '../lib/actions/user.actions';
import { useRouter, useSearchParams } from 'next/navigation';
import PostDetails from '../components/postdetails';
import '../styles.css';

interface ClerkData {
  userId: string;
  image: string;
  firstName: string;
  lastName: string;
}

interface UserData {
  _id: string;
  clerkUserId: string;
  followers: { creator: string; image: string; clerkId: string; userId: string; isFollowed?: boolean; }[];
  followings: { creator: string; image: string; clerkId: string; userId: string; isFollowed?: boolean; }[];
  description: string;
  posts: string[];
  __v: number;
}

interface UserProfile {
  clerkData: ClerkData;
  updatedUserData: UserData;
}

interface ClerkUser {
  userId: string;
  image: string;
}

interface User {
  _id: string;
  followings: string[];
}

interface minimalPost {
  _id: string;
  imageLink: string;
  description: string;
  created_at: string;
}

const Page: React.FC = () => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [currentClerkUserId, setCurrentClerkUserId] = useState<string>("");
  const [currentUser, setCurrentUser] = useState<User>();
  const [isEditing, setIsEditing] = useState(false);
  const [description, setDescription] = useState("");
  const [followingsVisible, setFollowingsVisible] = useState(false);
  const [followersVisible, setFollowersVisible] = useState(false);
  const [followers, setFollowers] = useState<{ creator: string; clerkId: string; image: string; userId: string; isFollowed?: boolean }[]>([]);
  const [followings, setFollowings] = useState<{ creator: string; clerkId: string; image: string; userId: string; isFollowed?: boolean }[]>([]);
  const [posts, setPosts] = useState<minimalPost[]>([]);
  const [likedPosts, setLikedPosts] = useState<minimalPost[]>([]);
  const [selectedPost, setSelectedPost] = useState<minimalPost | null>(null);
  const [isPostDetailsVisible, setIsPostDetailsVisible] = useState(true);
  const [selectedTab, setSelectedTab] = useState('own');
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  
  const followersRef = useRef<HTMLDivElement>(null);
  const followingsRef = useRef<HTMLDivElement>(null);

  const urlParams = useSearchParams();

  const fetchUser = async () => {
    setLoading(true); // Start loading
    try {
      const id = urlParams.get('clerkId');
      if (!id) {
        console.error("No id found.");
        return;
      }
      const response = await axios.get<UserProfile>('/api/getProfile', {
        params: { clerkId: id }
      });
      if (response.data) {
        const { followers, followings, posts } = response.data.updatedUserData;
  
        setDescription(response.data.updatedUserData.description);
  
        const updatedFollowers = followers.map(follower => ({
          ...follower,
          isFollowed: followings.some(following => following.clerkId === follower.clerkId),
        }));
        setFollowers(updatedFollowers);
  
        const updatedFollowings = followings.map(following => ({
          ...following,
          isFollowed: true,
        }));
        setFollowings(updatedFollowings);
  
        // Check if there are posts before calling getImages
        if (posts.length > 0) {
          const imagesResponse = await axios.post<{ postId: string, imageLink: string }[]>('/api/getImages', { postIds: posts });
          const images = imagesResponse.data;
          
          const postsWithImages = posts.map(postId => {
            const image = images.find(img => img.postId === postId)?.imageLink || '';
            return { _id: postId, imageLink: image, description, created_at: '' };
          });
          setPosts(postsWithImages);
        } else {
          setPosts([]); // Set posts to an empty array if no posts are available
        }
  
        const likedResponse = await getLikedPosts(id);
        if (likedResponse) {
          const likedPostIds = likedResponse.map(post => post._id);
          
          // Check if there are liked posts before calling getImages
          if (likedPostIds.length > 0) {
            const likedImagesResponse = await axios.post<{ postId: string, imageLink: string }[]>('/api/getImages', { postIds: likedPostIds });
            const likedImages = likedImagesResponse.data;
  
            const likedPostsWithImages = likedResponse.map(post => ({
              ...post,
              imageLink: likedImages.find(img => img.postId === post._id)?.imageLink || '',
            }));
            setLikedPosts(likedPostsWithImages);
          } else {
            setLikedPosts([]); // Set liked posts to an empty array if no liked posts are available
          }
        }
  
        setUser(response.data);
        const clerkResponse = await axios.get<ClerkUser>('/api/getUserId');
        setCurrentClerkUserId(clerkResponse.data.userId);
  
        const userResponse = await axios.get<User>('/api/getUser');
        setCurrentUser(userResponse.data);
      } else {
        router.push('/')
        throw new Error('User not authenticated');
      }
    } catch (error) {
      console.error("Error fetching user ID or user data:", error);
    } finally {
      setLoading(false); // End loading
    }
  };  

  useEffect(() => {
    fetchUser();
  }, [urlParams, isPostDetailsVisible]);    

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        (followersVisible && followersRef.current && !followersRef.current.contains(event.target as Node)) ||
        (followingsVisible && followingsRef.current && !followingsRef.current.contains(event.target as Node))
      ) {
        setFollowersVisible(false);
        setFollowingsVisible(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [followersVisible, followingsVisible]);

  const handleEditClick = () => setIsEditing(true);

  const handleSaveClick = async () => {
    if (user) {
      setIsEditing(false);
      try {
        setLoading(true); // Start loading
        await updateDescription(user.clerkData.userId, description);
        console.log("Description updated successfully");
      } catch (error) {
        console.error("Error updating description:", error);
      } finally {
        setLoading(false); // End loading
      }
    }
  };

  const handleFollowClick = async (followUserId: string, isFollowed: boolean) => {
    try {
      setLoading(true); // Start loading
      if (user?.clerkData.userId) {
        await followUser(user.clerkData.userId, followUserId, !isFollowed);
        setFollowers(prevFollowers =>
          prevFollowers.map(follower =>
            follower.clerkId === followUserId
              ? { ...follower, isFollowed: !isFollowed }
              : follower
          )
        );
  
        setFollowings(prevFollowings =>
          prevFollowings.map(following =>
            following.clerkId === followUserId
              ? { ...following, isFollowed: !isFollowed }
              : following
          )
        );
  
        await fetchUser();
      }
    } catch (error) {
      console.error("Error handling follow click:", error);
    } finally {
      setLoading(false); // End loading
    }
  };

  const handleTabClick = (tab: string) => {
    setSelectedTab(tab);
    renderPosts()
  };

  const handlePostClick = (post: minimalPost) => {
    setSelectedPost(post)
    setIsPostDetailsVisible(true);
  };

  const handleUserClick = (followClerkId: string) => {
    router.push(`/profile?clerkId=${followClerkId}`)
    setFollowersVisible(false);
    setFollowingsVisible(false);
  }

  const toggleFollowings = () => {
    setFollowingsVisible(!followingsVisible);
  }

  const toggleFollowers = () => {
    setFollowersVisible(!followersVisible);
  }

  const renderPosts = () => {
    const displayPosts = selectedTab === 'own' ? posts : likedPosts;
    return displayPosts.length > 0 ? (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {displayPosts.map((post, index) => (
          <div
            key={index}
            className="relative w-full h-32 bg-gray-200 rounded overflow-hidden group"
            onClick={() => handlePostClick(post)}
          >
            {post.imageLink && (
              <img
                src={post.imageLink}
                alt={`Post ${post._id}`}
                className="w-full h-full object-cover transition duration-300 group-hover:filter group-hover:grayscale"
              />
            )}
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition duration-300 bg-gray-800 bg-opacity-50 text-white text-lg">
              View
            </div>
          </div>
        ))}
      </div>
    ) : (
      <p className="text-center text-gray-500">No {selectedTab === 'own' ? 'posts available' : 'liked posts available'}.</p>
    );
  };
  

  if (!user) return <p>Loading...</p>;

  const params = new URLSearchParams({
    height: "200",
    width: "200",
    quality: "100",
    fit: "crop",
  });

  const imageSrc = `${user.clerkData.image}?${params.toString()}`;

  return (
    <div className='bg-white z-1'>
      <NavBar />
      <div className="flex flex-col items-center justify-center mt-5">
        
      {/* User Info Card */}
      <div className="w-full max-w-4xl h-auto bg-white shadow-lg rounded-lg relative">
        <div className='flex text-black p-5 mx-5 items-center'>
          <img className='rounded-full w-[20vw] h-auto' src={imageSrc} alt="User profile"/>
          <div className='ml-8 flex-1'>
            <div className='flex items-center justify-normal md:justify-between'>
              <div className='flex items-center'>
                <div className='font-bold text-xl'>{user.clerkData.firstName} {user.clerkData.lastName}</div>
                {isEditing ? (
                  <button className='ml-3 py-1 px-2 text-sm bg-blue-500 hover:bg-blue-700 text-white rounded' onClick={handleSaveClick}>Save</button>
                ) : (
                  <div className="relative group">
                    <i className="fa-solid fa-pen-to-square ml-3 text-xl hover:text-blue-500 transition-transform duration-300 hover:scale-110" onClick={handleEditClick}></i>
                  <div className="absolute left-5 transform hidden z-50 group-hover:block bg-rose-400 text-white text-xs rounded py-1 px-2 text-center" style={{ width: '110px' }}>
                    Edit Description
                  </div>
                </div>        
                )}
              </div>
              <SignOutButton>
                <button className='ml-3 flex items-center transition-transform duration-300 hover:scale-110'>
                  <div className="relative group">
                    <i className="fa-solid fa-right-from-bracket text-2xl text-rose-500 hover:text-rose-700"></i>
                  <div className="absolute left-5 transform hidden z-50 group-hover:block bg-rose-400 text-white text-xs rounded py-1 px-2 text-center" style={{ width: '70px' }}>
                    Sign out
                  </div>
                </div>     
                </button>
              </SignOutButton>
            </div>
            <div className='flex md:flex-row flex-col justify-start md:space-x-4 mt-2'>
              <div>{user.updatedUserData.posts.length} posts</div>
              <div className="relative group">
                <div onClick={toggleFollowers} className='cursor-pointer hover:font-bold'><u>{user.updatedUserData.followers.length} followers</u></div>
                <div className="absolute left-5 z-50 transform hidden group-hover:block bg-gray-500 text-white text-xs text-center rounded py-1 px-2" style={{ width: '100px' }}>
                  View followers
                </div>
              </div>
              <div className="relative group">
                <div onClick={toggleFollowings} className='cursor-pointer hover:font-bold'><u>{user.updatedUserData.followings.length} followings</u></div>
                <div className="absolute left-5 z-50 transform hidden group-hover:block bg-gray-500 text-white text-center text-xs rounded py-1 px-2" style={{ width: '110px' }}>
                  View followings
                </div>
              </div>
            </div>
            <div className='text-left mt-4 w-full text-sm'>
              {isEditing ? (
                <div className='flex flex-col'>
                  <div className='w-full max-w-2xl'>
                    <Textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      maxLength={250}
                    />
                  </div>
                </div>
              ) : (
                <div className='w-screen max-w-xl'>{description}</div>
              )}
            </div>
          </div>
        </div>
      </div>
  
        {/* Tab Control */}
        <div className="w-full max-w-4xl mt-5">
          <div className="flex border-b border-gray-300">
            <button
              className={`px-4 py-2 focus:outline-none ${selectedTab === 'own' ? 'border-b-2 border-blue-500 text-blue-500' : 'text-gray-500'}`}
              onClick={() => handleTabClick('own')}
            >
              Posts
            </button>
            <button
              className={`px-4 py-2 focus:outline-none ${selectedTab === 'liked' ? 'border-b-2 border-blue-500 text-blue-500' : 'text-gray-500'}`}
              onClick={() => handleTabClick('liked')}
            >
              Liked Posts
            </button>
          </div>
          <div className="p-4">{renderPosts()}</div>
        </div>
      </div>
      
      {/* Post Details Visible */}
      {isPostDetailsVisible && (
        <PostDetails minimalPost={selectedPost} user={currentUser} clerkUserId={currentClerkUserId} onClose={() => setIsPostDetailsVisible(false)} />
      )}

    // Followers Box
    {followersVisible && (
      <div
        ref={followersRef}
        className="absolute top-16 left-1/2 transform bg-white z-30 rounded-xl flex flex-col shadow-xl overflow-y-auto custom-scrollbar"
        style={{
          width: '400px',
          height: '600px',  // Fixed height for the box
          margin: '0',
          transform: 'translate(-50%, 10%)',
        }}
      >
        <div className="p-5 text-black">
          <h4 className="font-semibold text-2xl text-center mb-3">Followers</h4>
          <button onClick={() => setFollowersVisible(false)} className="absolute top-2 right-1 pr-2 text-gray-600 hover:text-gray-900">
            ✖
          </button>
          <ul>
            {followers.length > 0 ? (
              followers.map(follower => (
                <li key={follower.clerkId} className="py-2 px-4 border-b flex items-center">
                  <img 
                    className='rounded-full mr-3' 
                    src={`${follower.image}?${new URLSearchParams({ height: "32", width: "32", quality: "100", fit: "crop" })}`} 
                    alt={`${follower.creator}'s profile`}
                  />
                  <div className="relative group">
                    <span className="flex-grow hover:text-blue-500" onClick={() => handleUserClick(follower.clerkId)}>{follower.creator}</span>
                    <div className="absolute left-5 z-50 transform hidden group-hover:block bg-blue-500 text-white text-center text-xs rounded py-1 px-2" style={{ width: '90px' }}>
                      View Profile
                    </div>
                  </div>
                  <button
                    className={`ml-auto transition transform hover:scale-110 px-2 p-1 rounded ${follower.isFollowed ? 'bg-red-600' : 'bg-red-400'}`}
                    onClick={() => handleFollowClick(follower.userId, follower.isFollowed || false)}
                  >
                    {follower.isFollowed ? '✓ Followed' : 'Follow'}
                  </button>
                </li>
              ))
            ) : (
              <p className="text-center text-gray-500">You have no followers.</p>
            )}
          </ul>
        </div>
      </div>
    )}

    // Followings Box
    {followingsVisible && (
      <div
        ref={followingsRef}
        className="absolute top-16 left-1/2 transform -translate-x-1/2 bg-white z-30 rounded-xl flex flex-col shadow-xl overflow-y-auto custom-scrollbar"
        style={{
          width: '400px',
          height: '600px',  // Fixed height for the box
          margin: '0',
          transform: 'translate(-50%, 10%)',
        }}
      >
        <div className="p-5 text-black">
          <h4 className="font-semibold text-2xl text-center mb-3">Followings</h4>
          <button onClick={() => setFollowingsVisible(false)} className="absolute top-2 right-1 pr-2 text-gray-600 hover:text-gray-900">
            ✖
          </button>
          <ul>
            {followings.length > 0 ? (
              followings.map(following => (
                <li key={following.clerkId} className="py-2 px-4 border-b flex items-center">
                  <img 
                    className='rounded-full mr-3' 
                    src={`${following.image}?${new URLSearchParams({ height: "32", width: "32", quality: "100", fit: "crop" })}`} 
                    alt={`${following.creator}'s profile`}
                  />
                  <div className="relative group">
                    <span className="flex-grow hover:text-blue-500" onClick={() => handleUserClick(following.clerkId)}>{following.creator}</span>
                    <div className="absolute left-5 z-50 transform hidden group-hover:block bg-blue-500 text-white text-center text-xs rounded py-1 px-2" style={{ width: '90px' }}>
                      View Profile
                    </div>
                  </div>
                  <button
                    className={`ml-auto transition transform hover:scale-110 px-2 p-1 rounded ${following.isFollowed ? 'bg-red-600' : 'bg-red-400'}`}
                    onClick={() => handleFollowClick(following.userId, following.isFollowed || false)}
                  >
                    {following.isFollowed ? '✓ Followed' : 'Follow'}
                  </button>
                </li>
              ))
            ) : (
              <p className="text-center text-gray-500">You have no followings.</p>
            )}
          </ul>
        </div>
      </div>
    )}


    {loading && (
      <div className="fixed inset-0 flex items-center justify-center z-50 bg-transparent">
        <img src="/cookieLoad.gif" alt="Loading" className="lg:w-[15vw] lg:h-[15vw] w-[25vw] h-[25vw]" />
      </div>
    )}

    </div>
  );
};

export default Page;