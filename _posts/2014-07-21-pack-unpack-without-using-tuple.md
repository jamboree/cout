---
layout : post
title : Pack/Unpack without Using Tuple
commentId : 2
category: Tricks
tags:
  - c++1y
  - lambda
---

Args packing/unpacking is particularly useful when the args aren't handled immediately, but stored for later invocation.
In this post, I'll show you a practical way to do it without resorting to tuple.
Before the journey start, let's see how we used to do args packing/unpacking using `std::tuple` and `std::integer_sequence`.

### The Offical Way

Packing the args is quite easy:

{% highlight c++ %}
auto args = std::make_tuple(1, "hey");
{% endhighlight %}

Unpacking needs more code, we first write a helper function `invoke` that can be reused:

{% highlight c++ %}
template<class F, std::size_t... Ns, class... Ts>
decltype(auto) invoke_impl(F&& f, std::index_sequence<Ns...>, std::tuple<Ts...> const& params)
{
    return f(std::get<Ns>(params)...);
}

template<class F, class... Ts>
decltype(auto) invoke(F&& f, std::tuple<Ts...> const& params)
{
    return invoke_impl(f, std::make_index_sequence<sizeof...(Ts)>(), params);
}
{% endhighlight %}

Now you can use it to unpack the args:

{% highlight c++ %}
invoke(do_something, args);
{% endhighlight %}

Not hard at all.
But do we really need `std::tuple` for that kind of thing?
Well, no. In c++1y, the language itself provides us a powerful tool -- generic lambda.

### The Alternative

The idea is simple:

{% highlight c++ %}
template<class... T>
auto pack(T... t)
{
    return [=](auto&& f)->decltype(auto)
    {
        return f(t...);
    };
};
{% endhighlight %}

And the usage is very simple as well:

{% highlight c++ %}
auto args = pack(1, "hey");
args(do_something);
{% endhighlight %}

However, it doesn't support move-only types. Before we step further, there's another noticeable c++1y feature -- init-capture, which lets you do something like:

{% highlight c++ %}
template<class T>
auto pack(T t)
{
    return [t=std::move(t)](auto&& f)->decltype(auto)
    {
        return f(t);
    };
};
{% endhighlight %}

As a imaginative C++ programmer, you probably already come up with this:

{% highlight c++ %}
template<class... T>
auto pack(T... t)
{
    return [t=std::move(t)...](auto&& f)->decltype(auto)
    {
        return f(t...);
    };
};
{% endhighlight %}

Looks great, but it won't compile!
There's a [thread](https://groups.google.com/a/isocpp.org/forum/#!topic/std-discussion/ePRzn4K7VcM) in the ISO C++ group discussing this issue if you're interested.

Anyway, we have to find a workaround. We know that people can already do this in c++11 without init-capture, so the situation is same here. The basic idea is: make a move-proxy the does move when copying.

{% highlight c++ %}
template<class T>
struct mover
{
    mover(T const& val) : val(val) {}

    mover(T&& val) : val(std::move(val)) {}

    mover(mover const& other) = default;

    mover(mover&& other) = default; 

    mover(mover& other) : val(std::move(other.val)) {}

    operator T const&() const
    {
        return val; 
    }

    T val;
};
{% endhighlight %}

And to decide when is needed or beneficial to apply the `mover`, we write a helper trait `wrap_t`:

{% highlight c++ %}
template<class T>
using wrap_t = typename std::conditional
    <
        std::is_move_constructible<T>::value
    && !std::is_trivially_copy_constructible<T>::value
      , mover<T>
      , T
    >::type;
{% endhighlight %}

In case that your standard library doesn't support `std::is_trivially_copy_constructible`, use instead:

{% highlight c++ %}
template<class T>
using wrap_t = typename std::conditional
    <
        std::is_move_constructible<T>::value
    && !(std::is_copy_constructible<T>::value && boost::has_trivial_copy_constructor<T>::value)
      , mover<T>
      , T
    >::type;
{% endhighlight %}

But `boost::has_trivial_copy_constructor` seems to report false positive, so we also use `std::is_copy_constructible` here.

We can implement `pack` as below:

{% highlight c++ %}
template<class... Ts>
auto pack_impl(wrap_t<Ts>... ts)
{
    return [=](auto&& f)->decltype(auto)
    {
        return f(static_cast<Ts const&>(ts)...);
    };
}

auto const pack = [](auto&&... ts)
{
    return pack_impl<std::decay_t<decltype(ts)>...>(static_cast<decltype(ts)>(ts)...);
};
{% endhighlight %}

If you're confused about `static_cast<decltype(ts)>`, it's just perfect forwarding, exactly the same as `std::forward`, written in another form.

You can use normal function template instead of generic lambda here, but I'd like to use lambda when possible since it may provide some benefit over function template, for example, the symbol names of lambda are in general shorter than those of template functions, and it's also a effective factor of compile/link time.

We're almost done here. Let's write a special class `A` to test the behavior:

{% highlight c++ %}
struct A
{
    A() = default;

    A(A&&)
    {
        std::cout << "move\n";
    }

    A(A const&)
    {
        std::cout << "copy\n";
    }
};
{% endhighlight %}

Now test it:

{% highlight c++ %}
A a;
std::cout <<"p1------------\n";
auto p1 = pack(std::move(a));
std::cout <<"p2------------\n";
auto p2 = std::move(p1);
std::cout <<"p3------------\n";
auto p3 = p2;
{% endhighlight %}

code above will print:

{% highlight text %}
p1------------
move
move
p2------------
move
p3------------
copy
{% endhighlight %}

Note that when constructing `p1`, `A` is moved twice, if the language supports init-capture on parameter pack, there'd be only one move. Still, there's some workaround if you really care about it, but let me stop here :p
