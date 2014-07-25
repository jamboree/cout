---
layout : post
title : "Lambda: Overloading and Recursive"
commentId : 3
category: Tricks
tags:
  - c++1y
  - lambda
---

Lambda expression is very handy, but there're some restrictions -- it can't be overloaded and it can't call itself.
Well, only at language level. It's completely doable to overload lambdas and make it recursive-enabled, in a library fashion.

### Recursive Lambda in C++11

Surely you can already use lambda recursively in c++11, with the help of `std::function`.

{% highlight c++ %}
std::function<int(int)> factorial = [&factorial](int i)
{
    return i == 0? 1 : i * factorial(i - 1);
};
{% endhighlight %}

But then you suffer the runtime penalty of std::function.

### Recursive Lambda in C++1y

With the introduction of generic lambda in c++1y, we can avoid the overhead:

{% highlight c++ %}
auto factorial = [](auto self, int i)->int
{
    return i == 0? 1 : i * self(self, i - 1);
};
{% endhighlight %}

Note that how the recursive call is written: `self(self, i - 1)`.
In the user code, you have to call it in the same way:

{% highlight c++ %}
factorial(factorial, n);
{% endhighlight %}

It's a bit ugly because the functor itself has to appear twice in one call.
To make it more appealing, with the same signature as a normal one, we can make a wrapper:

{% highlight c++ %}
template<class F>
struct recursive
{
    template<class... Ts>
    decltype(auto) operator()(Ts&&... ts) const
    {
        return f(*this, std::forward<Ts>(ts)...);
    }
    
    F f;
};

auto const make_recursive = [](auto f)
{
    return recursive<decltype(f)>{std::move(f)};
};
{% endhighlight %}

Now we can use `make_recursive` to define the lambda:

{% highlight c++ %}
auto factorial = make_recursive([](auto& self, int i)->int
{
    return i == 0? 1 : i * self(i - 1);
});
{% endhighlight %}

Voila! In the lambda body, we can spell `self(i - 1)` instead of `self(self, i - 1)` as in the above example.
In the user code, we can call `factorial(n)` as usual. Perfect, isn't it?

Let's move on to the next topic -- overloading.

### Overload Lambdas

C++ allows us to overload functions, but what a lambda expression gives us is a closure, that is, a function object.
You can't overload the variables:

{% highlight c++ %}
auto f = [](){...};
auto f = [](int){...};
{% endhighlight %}

Yet, we can make a wrapper. A simplest way that comes to mind is:

{% highlight c++ %}
template<class... Fs>
struct overload : Fs...
{
    overload(Fs&&... fs)
      : Fs(std::move(fs))...
    {}
};

auto const make_overload = [](auto... fs)
{
    return overload<decltype(fs)...>{std::move(fs)...};
};
{% endhighlight %}

Make an overloaded functor and call it:

{% highlight c++ %}
auto f = make_overload
(
    []{ std::cout << "1\n"; }
  , [](int){ std::cout << "2\n"; }
);
 
f();
f(2);
{% endhighlight %}

It works fine with clang 3.5, but g++ 4.9.1 doesn't buy it.
Actually, g++ seems to be correct here, see this [stackoverflow question](http://stackoverflow.com/questions/5368862/why-do-multiple-inherited-functions-with-same-name-but-different-signatures-not).

So, we have to use `operator()` from the bases explicitly, but it's illegal to write:

{% highlight c++ %}
using Fs::operator()...;
{% endhighlight %}

Instead, we have to do:

{% highlight c++ %}
template<class F, class... Fs>
struct overload : F, overload<Fs...>
{
    using F::operator();
    using overload<Fs...>::operator();

    overload(F&& f, Fs&&... fs)
      : F(std::move(f))
      , overload<Fs...>(std::move(fs)...)
    {}
};

template<class F>
struct overload<F> : F
{
    using F::operator();

    overload(F&& f)
      : F(std::move(f))
    {}
};
{% endhighlight %}

That's it.

So far I've shown you how to make a recursive lambda and how to overload them, what next?
Well, let's combine the two :)

### Recursive and Overloaded Lambda

Recursive template function calls are often not really recursive, actually different functions are called, they just happened to have the same name, at least to the programmer.
And usually, we need to deal with the special cases by overloading the function. Combing both tricks makes generic lambda more powerful.

Let's write a helper function that ties them up:
{% highlight c++ %}
auto const make_recursive_overload = [](auto&&... fs)
{
    return make_recursive(make_overload(static_cast<decltype(fs)>(fs)...));
};
{% endhighlight %}

Now we can play with it. For instance, to implement a recursive for_each for variadic param-pack:

{% highlight c++ %}
auto const for_each = make_recursive_overload
(
    [](auto& self, auto&& f, auto&& t, auto&&... ts)
    {
        f(static_cast<decltype(t)>(t));
        self(f, static_cast<decltype(ts)>(ts)...);
    }
  , [](auto& self, auto&& f) {}
);
{% endhighlight %}

The first overload does the recursive call, and the second one is the termination condition.
This is how it is used:

{% highlight c++ %}
for_each([](auto&& val)
{
    std::cout << val << ',';
}, 1, 2, 3, 4);
{% endhighlight %}

If you remember my last [post](http://jamboree.github.io/cout/tricks/2014/07/21/pack-unpack-without-using-tuple.html) about param-pack, you could have more fun:

{% highlight c++ %}
auto const each = [](auto&& f)
{
    return [&](auto&&... ts)
    {
        for_each(f, static_cast<decltype(ts)>(ts)...);
    };
};

auto p = pack(1, 2, 3, 4);
p(each([](auto&& val)
{
    std::cout << val << ',';
}));
{% endhighlight %}
